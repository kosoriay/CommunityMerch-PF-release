"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { refundOrder } from "@/lib/refunds"

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
