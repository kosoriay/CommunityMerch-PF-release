"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { refundOrder } from "@/lib/refunds"
import { submitFulfillment } from "@/lib/fulfillment"
import { getOrder, updateShippingAddress } from "@/lib/orders"

async function requirePlatformAdmin() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (session?.user.platformRole !== "platform_admin") redirect("/admin/dashboard")
  return session
}

export type RefundFormState = {
  error?: string
  needsConfirmation?: boolean
  success?: string
}

/**
 * Refund an order. `platform_admin` only — `platform_staff` is a read-only
 * support role and must not be able to move money.
 */
export async function refundOrderAction(
  orderId: string,
  _prev: RefundFormState | undefined,
  formData: FormData
): Promise<RefundFormState> {
  const session = await requirePlatformAdmin()

  const reason = String(formData.get("reason") ?? "")
  const acknowledgeShortfall = formData.get("acknowledgeShortfall") === "on"

  const result = await refundOrder({
    orderId,
    reason,
    refundedByUserId: session.user.id,
    acknowledgeShortfall,
  })

  if (!result.ok) {
    return { error: result.error, needsConfirmation: result.needsConfirmation }
  }

  revalidatePath(`/admin/orders/${orderId}`)
  revalidatePath("/admin/orders")
  revalidatePath("/admin/dashboard")
  return { success: `Refunded. Stripe reference ${result.refundId}.` }
}

export type RetryFormState = { error?: string; success?: string }

/**
 * Re-run fulfilment for an order that failed.
 *
 * Safe to press repeatedly: Printful deduplicates on `external_id`, so a
 * duplicate submission returns the existing order rather than printing twice.
 * Notification is suppressed — the operator is already looking at the result.
 */
export async function retryFulfillmentAction(
  orderId: string,
  _prev: RetryFormState | undefined
): Promise<RetryFormState> {
  await requirePlatformAdmin()

  await submitFulfillment(orderId, { notifyOnFailure: false })

  // submitFulfillment records failures rather than throwing, so read the
  // order back to find out what actually happened.
  const order = await getOrder(orderId)
  revalidatePath(`/admin/orders/${orderId}`)
  revalidatePath("/admin/dashboard")

  if (!order) return { error: "Order not found" }
  if (order.fulfillmentError) {
    return { error: `Still failing: ${order.fulfillmentError}` }
  }
  return {
    success: order.printfulOrderId
      ? `Sent to production. Printful order #${order.printfulOrderId}.`
      : "Fulfillment submitted.",
  }
}

export type AddressFormState = { error?: string; success?: string }

/**
 * Correct a recipient address before retrying. Address rejections — a state
 * and ZIP that disagree, a missing line — are the most common fixable cause,
 * and there was no way to edit one without going into the database.
 */
export async function updateAddressAction(
  orderId: string,
  _prev: AddressFormState | undefined,
  formData: FormData
): Promise<AddressFormState> {
  await requirePlatformAdmin()

  const get = (k: string) => String(formData.get(k) ?? "").trim()
  const line1 = get("line1")
  const city = get("city")
  const state = get("state")
  const postal = get("postal_code")

  if (!line1 || !city || !state || !postal) {
    return { error: "Street address, city, state and ZIP are all required." }
  }
  if (!/^[A-Za-z]{2}$/.test(state)) {
    return { error: "State must be a two-letter code, for example NY." }
  }
  if (!/^\d{5}(-\d{4})?$/.test(postal)) {
    return { error: "ZIP must be 5 digits, optionally +4." }
  }

  await updateShippingAddress(
    orderId,
    { line1, line2: get("line2") || undefined, city, state: state.toUpperCase(), postal_code: postal },
    get("buyer_name") || undefined
  )
  revalidatePath(`/admin/orders/${orderId}`)
  return { success: "Address updated. Retry fulfillment to send it to production." }
}
