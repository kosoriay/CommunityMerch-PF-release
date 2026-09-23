import { db } from "@/lib/db/client"
import { user } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { getOrCreateConfig } from "@/lib/platform-config"
import {
  sendFulfillmentFailureEmail,
  sendPrintfulResolutionEmail,
  sendPrintfulStatusAlertEmail,
  sendOrderAnomalyEmail,
} from "@/lib/email"
import { printfulFixGuidance } from "@/lib/printful-status"
import type { PrintfulAlertClaim } from "@/lib/orders"

/**
 * 運営者の宛先。platform_admin 全員、いなければサポート窓口（設計 C21）。
 * 以前は2つの関数に同じコードが複製されていた。
 */
async function operatorRecipients(): Promise<{ recipients: string[]; platformName: string }> {
  const [admins, config] = await Promise.all([
    db.query.user.findMany({ where: eq(user.platformRole, "platform_admin") }),
    getOrCreateConfig(),
  ])
  const recipients = admins.map((a) => a.email).filter(Boolean)
  if (recipients.length === 0 && config.supportEmail) {
    recipients.push(config.supportEmail)
  }
  return { recipients, platformName: config.platformName }
}

function adminOrderUrl(orderId: string): string | null {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.BETTER_AUTH_URL ?? ""
  return appUrl ? `${appUrl}/admin/orders/${orderId}` : null
}

/**
 * Tell the operator that a paid order did not reach the print provider.
 *
 * Until this existed the only trace of the failure was a line in the function
 * logs, so a buyer could pay and simply never receive anything with nobody
 * aware. Sent to every platform admin, falling back to the support address.
 *
 * Best-effort throughout: alerting must never turn a fulfilment failure into
 * an unhandled exception, because the caller is already handling a failure.
 */
export async function alertFulfillmentFailure(params: {
  orderId: string
  campaignTitle: string
  orgName: string
  buyerEmail: string | null
  error: string
  attempts: number
}): Promise<void> {
  try {
    const { recipients, platformName } = await operatorRecipients()
    if (recipients.length === 0) {
      console.warn(`[fulfillment-alert] nobody to notify about order ${params.orderId}`)
      return
    }
    await sendFulfillmentFailureEmail(recipients, {
      ...params,
      orderUrl: adminOrderUrl(params.orderId),
      platformName,
    })
  } catch (err) {
    console.error(`[fulfillment-alert] could not notify for ${params.orderId}`, err)
  }
}

/**
 * Tell the operator that Printful resolved something on their side.
 *
 * Printful emits these; we cannot file a claim through the API, so this is the
 * only way the platform owner hears the outcome without opening the Printful
 * dashboard. Until this existed a refund credited back to them, or a package
 * coming home, arrived as silence.
 *
 * Best-effort like the failure alert: a webhook must still return 200.
 */
export async function alertPrintfulResolution(params: {
  orderId: string
  event: "order_refunded" | "package_returned"
  campaignTitle: string
  orgName: string
  printfulOrderId: string | null
}): Promise<void> {
  try {
    const { recipients, platformName } = await operatorRecipients()
    if (recipients.length === 0) {
      console.warn(`[printful-resolution] nobody to notify about order ${params.orderId}`)
      return
    }
    await sendPrintfulResolutionEmail(recipients, {
      ...params,
      orderUrl: adminOrderUrl(params.orderId),
      platformName,
    })
  } catch (err) {
    console.error(`[printful-resolution] could not notify for ${params.orderId}`, err)
  }
}

/**
 * Printful が受け付けた後で止めた注文を知らせる（設計 §5.2・§5.5）。
 * 1件（webhook・発注時）でも複数（定期照会）でも**1通**にまとめる。
 * `notes` は照会全体の所見（認証エラー・全件 404）。best-effort — 例外を投げない。
 *
 * 戻り値は「送れたか」（最終レビュー指摘）。呼び出し側（cron のダイジェスト）は、
 * 送れなかったときに `claimPrintfulAlert` で取った権利を返し、次回また通知できる
 * ようにする必要がある。best-effort の性質は変えない — ここは常に例外を投げず、
 * 失敗は戻り値の `false` で表す。
 */
export async function alertPrintfulStatusProblems(
  claims: PrintfulAlertClaim[],
  notes: string[] = []
): Promise<boolean> {
  if (claims.length === 0 && notes.length === 0) return true
  const ids = claims.map((c) => c.orderId).join(",")
  try {
    const { recipients, platformName } = await operatorRecipients()
    if (recipients.length === 0) {
      console.warn(`[printful-status-alert] nobody to notify about ${ids || "the Printful status check"}`)
      return false
    }
    await sendPrintfulStatusAlertEmail(recipients, {
      platformName,
      notes,
      items: claims.map((c) => ({
        orderId: c.orderId,
        campaignTitle: c.campaignTitle,
        orgName: c.orgName,
        printfulStatus: c.printfulStatus,
        printfulStatusReason: c.printfulStatusReason,
        printfulOrderId: c.printfulOrderId,
        guidance: printfulFixGuidance(c.printfulStatus),
        orderUrl: adminOrderUrl(c.orderId),
      })),
    })
    return true
  } catch (err) {
    console.error(`[printful-status-alert] could not notify for ${ids}`, err)
    return false
  }
}

export type OrderAnomaly =
  | { kind: "created_after_refund"; status: string }
  | { kind: "shipped_after_refund" }

/**
 * 状態から見て起きてはいけないことが起きた（設計 §5.3 手順3・§5.4）。best-effort。
 */
export async function alertOrderAnomaly(params: {
  orderId: string
  campaignTitle: string
  orgName: string
  printfulOrderId: string | null
  anomaly: OrderAnomaly
}): Promise<void> {
  const { headline, detail } =
    params.anomaly.kind === "created_after_refund"
      ? {
          headline: `Printful created an order that is already ${params.anomaly.status}`,
          detail: `This order is ${params.anomaly.status} here, but Printful has just created an order for it. Consider canceling it in Printful so it is not printed and charged to you.`,
        }
      : {
          headline: "Printful shipped an order that was already refunded",
          detail: "The buyer was refunded, and Printful has now shipped the order anyway. No shipping email was sent to the buyer.",
        }
  try {
    const { recipients, platformName } = await operatorRecipients()
    if (recipients.length === 0) {
      console.warn(`[order-anomaly] nobody to notify about order ${params.orderId}`)
      return
    }
    await sendOrderAnomalyEmail(recipients, {
      orderId: params.orderId,
      headline,
      detail,
      campaignTitle: params.campaignTitle,
      orgName: params.orgName,
      printfulOrderId: params.printfulOrderId,
      orderUrl: adminOrderUrl(params.orderId),
      platformName,
    })
  } catch (err) {
    console.error(`[order-anomaly] could not notify for ${params.orderId}`, err)
  }
}
