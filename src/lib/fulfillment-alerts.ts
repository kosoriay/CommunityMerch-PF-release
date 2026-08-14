import { db } from "@/lib/db/client"
import { user } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { getOrCreateConfig } from "@/lib/platform-config"
import { sendFulfillmentFailureEmail } from "@/lib/email"

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
    const [admins, config] = await Promise.all([
      db.query.user.findMany({ where: eq(user.platformRole, "platform_admin") }),
      getOrCreateConfig(),
    ])

    const recipients = admins.map((a) => a.email).filter(Boolean)
    if (recipients.length === 0 && config.supportEmail) {
      recipients.push(config.supportEmail)
    }
    if (recipients.length === 0) {
      console.warn(`[fulfillment-alert] nobody to notify about order ${params.orderId}`)
      return
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.BETTER_AUTH_URL ?? ""
    await sendFulfillmentFailureEmail(recipients, {
      ...params,
      orderUrl: appUrl ? `${appUrl}/admin/orders/${params.orderId}` : null,
      platformName: config.platformName,
    })
  } catch (err) {
    console.error(`[fulfillment-alert] could not notify for ${params.orderId}`, err)
  }
}
