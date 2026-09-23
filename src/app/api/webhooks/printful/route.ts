import { NextRequest, NextResponse, after } from "next/server"
import {
  markOrderShipped,
  getOrder,
  recordPrintfulObservation,
  recordPrintfulCheckFailure,
  claimPrintfulAlert,
} from "@/lib/orders"
import { sendShippingNotificationEmail } from "@/lib/email"
import { fromPrintfulExternalId } from "@/lib/printful-ids"
import { getOrCreateConfig } from "@/lib/platform-config"
import { alertPrintfulResolution, alertPrintfulStatusProblems, alertOrderAnomaly } from "@/lib/fulfillment-alerts"
import { getPrintfulOrder, isPrintfulAutoConfirm, type PrintfulOrderLookup } from "@/lib/providers/printful"
import { PRINTFUL_NOT_FOUND, reasonForObservation } from "@/lib/printful-status"

if (!process.env.PRINTFUL_WEBHOOK_SECRET) {
  throw new Error("PRINTFUL_WEBHOOK_SECRET is required")
}
const WEBHOOK_SECRET = process.env.PRINTFUL_WEBHOOK_SECRET

/**
 * Printful の状態が変わったことを知らせるイベント（設計 §5.4）。payload の status は
 * 使わず、Printful に取り直す。登録は docs/2-setup/00-START-HERE.md 4-3。
 */
const STATUS_EVENTS = new Set([
  "order_failed",
  "order_canceled",
  "order_put_hold",
  "order_put_hold_approval",
  "order_remove_hold",
  "order_updated",
])

/** 全イベント共通の封筒（type / data.order.external_id）を検証したもの。 */
type Envelope = { type: string; externalId: string; data: Record<string, unknown> }

/**
 * payload の形を検証する。不正なら null。以前は3経路とも `try` の外で
 * `payload.data.order.external_id` を分解しており、`data.order` の無い payload で
 * 例外になっていた（C11）。不正な payload は再送させても直らないので 200 で捨てる
 * （取りこぼしは定期照会が拾う）。
 */
function parseEnvelope(payload: unknown): Envelope | null {
  if (typeof payload !== "object" || payload === null) return null
  const { type, data } = payload as { type?: unknown; data?: unknown }
  if (typeof type !== "string" || typeof data !== "object" || data === null) return null
  const order = (data as { order?: unknown }).order
  if (typeof order !== "object" || order === null) return null
  const externalId = (order as { external_id?: unknown }).external_id
  if (typeof externalId !== "string" || externalId === "") return null
  return { type, externalId, data: data as Record<string, unknown> }
}

type Shipment = { carrier: string; tracking_number: string; tracking_url: string }

function parseShipment(data: Record<string, unknown>): Shipment | null {
  const shipment = data.shipment as Partial<Record<keyof Shipment, unknown>> | undefined
  if (!shipment || typeof shipment !== "object") return null
  const { carrier, tracking_number, tracking_url } = shipment
  if (typeof carrier !== "string" || typeof tracking_number !== "string" || typeof tracking_url !== "string") {
    return null
  }
  return { carrier, tracking_number, tracking_url }
}

function describeLookupFailure(lookup: Exclude<PrintfulOrderLookup, { kind: "found" } | { kind: "not_found" }>): string {
  switch (lookup.kind) {
    case "rate_limited":
      return "HTTP 429"
    case "unauthorized":
      return `HTTP ${lookup.httpStatus}`
    case "error":
      return lookup.message
  }
}

const ok = () => NextResponse.json({ received: true })

export async function POST(request: NextRequest) {
  // Authenticate via shared secret in query param
  const secret = request.nextUrl.searchParams.get("secret")
  if (secret !== WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const envelope = parseEnvelope(payload)
  if (!envelope) {
    console.error("[printful-webhook] malformed payload — no data.order.external_id")
    return ok()
  }

  try {
    if (envelope.type === "order_refunded" || envelope.type === "package_returned") {
      return await handleResolution(envelope, envelope.type)
    }
    if (envelope.type === "package_shipped") {
      return await handleShipped(envelope)
    }
    if (STATUS_EVENTS.has(envelope.type)) {
      return await handleStatusEvent(envelope)
    }
    return ok()
  } catch (err) {
    console.error("[printful-webhook] handler error:", err)
    return NextResponse.json({ error: "Handler error" }, { status: 500 })
  }
}

// Printful resolves claims on their side and tells us afterwards. We cannot
// file the claim through their API, so this is the only signal that a reprint
// was credited back or a package came home.
async function handleResolution(envelope: Envelope, event: "order_refunded" | "package_returned") {
  const resolvedId = fromPrintfulExternalId(envelope.externalId)
  const resolved = await getOrder(resolvedId)
  if (!resolved) {
    console.error(`[printful-webhook] order not found: ${resolvedId}`)
    return ok()
  }

  // Deliberately not touching `status`. `refunded` there means the buyer got
  // their money back through Stripe; Printful crediting the production cost
  // to the platform owner is a different event, and marking it as a buyer
  // refund would take the order out of revenue that the organization is
  // still owed.
  await alertPrintfulResolution({
    orderId: resolvedId,
    event,
    campaignTitle: resolved.campaign.title,
    orgName: resolved.campaign.org.name,
    printfulOrderId: resolved.printfulOrderId,
  })
  return ok()
}

async function handleShipped(envelope: Envelope) {
  // external_id is the hyphen-stripped order UUID (Printful's 32-char limit)
  const orderId = fromPrintfulExternalId(envelope.externalId)
  const shipment = parseShipment(envelope.data)
  if (!shipment) {
    console.error(`[printful-webhook] package_shipped without shipment details: ${orderId}`)
    return ok()
  }

  const order = await getOrder(orderId)
  if (!order) {
    console.error(`[printful-webhook] order not found: ${orderId}`)
    return ok()
  }

  // Idempotency: skip if already shipped
  if (order.status === "shipped" || order.status === "delivered") {
    console.log(`[printful-webhook] already shipped: ${orderId}`)
    return ok()
  }

  const moved = await markOrderShipped(orderId, {
    trackingNumber: shipment.tracking_number,
    carrier: shipment.carrier,
    trackingUrl: shipment.tracking_url,
  })

  if (!moved) {
    // 発送メールは遷移した側だけが送る。返金済みの注文が発送されたのは異常（C11b）
    const current = await getOrder(orderId)
    if (current?.status === "refunded") {
      await alertOrderAnomaly({
        orderId,
        campaignTitle: current.campaign.title,
        orgName: current.campaign.org.name,
        printfulOrderId: current.printfulOrderId,
        anomaly: { kind: "shipped_after_refund" },
      })
    } else {
      console.warn(`[printful-webhook] package_shipped for ${orderId} in status ${current?.status ?? "unknown"} — not recorded`)
    }
    return ok()
  }

  if (order.buyerEmail) {
    const config = await getOrCreateConfig()
    await sendShippingNotificationEmail(order.buyerEmail, {
      orderId,
      buyerName: order.buyerName ?? "Customer",
      campaignTitle: order.campaign.title,
      carrier: shipment.carrier,
      trackingNumber: shipment.tracking_number,
      trackingUrl: shipment.tracking_url,
      platformName: config.platformName,
      supportEmail: config.supportEmail,
    })
  }

  console.log(`[printful-webhook] shipped: order=${orderId} tracking=${shipment.tracking_number}`)
  return ok()
}

/**
 * 状態系イベント（設計 §5.4）。**payload の status は使わない。** Printful に取り直し、
 * Printful がいま持っている状態だけを書く。順序の逆転・重複・偽の payload（署名が
 * 無い）があっても、書かれるのは照会結果だけになる。
 */
async function handleStatusEvent(envelope: Envelope) {
  const orderId = fromPrintfulExternalId(envelope.externalId)
  const order = await getOrder(orderId)
  if (!order) {
    // 同じストアの、このアプリ以外の注文
    console.log(`[printful-webhook] ${envelope.type} for an order this app does not know: ${orderId}`)
    return ok()
  }

  const now = new Date()
  const lookup = await getPrintfulOrder(envelope.externalId)

  if (lookup.kind !== "found" && lookup.kind !== "not_found") {
    // 取り直せなかった。記録してから 500 を返す → Printful が再送する（P9）。
    // 記録するので、再送を待つ間も要対応の区分 C2 (a) に出る（§5.6）。
    await recordPrintfulCheckFailure(orderId, envelope.type, describeLookupFailure(lookup), now)
    return NextResponse.json({ error: "Could not confirm the order with Printful" }, { status: 500 })
  }

  const observation =
    lookup.kind === "found"
      ? { status: lookup.order.status, updated: lookup.order.updated }
      : { status: PRINTFUL_NOT_FOUND, updated: null }
  const reason = lookup.kind === "found"
    ? reasonForObservation(envelope.type, lookup.order.status, envelope.data.reason)
    : null

  await recordPrintfulObservation(orderId, observation, reason, envelope.type, now)
  const claim = await claimPrintfulAlert(orderId, isPrintfulAutoConfirm())
  if (claim) {
    // 通知は応答の後に回す（Printful の応答タイムアウトは明記が無い）
    after(async () => {
      await alertPrintfulStatusProblems([claim])
    })
  }
  return ok()
}
