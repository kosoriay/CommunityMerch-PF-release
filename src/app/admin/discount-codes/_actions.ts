"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { createDiscountCode, deactivateDiscountCode } from "@/lib/discount-codes"

async function requirePlatformAdmin() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (session?.user.platformRole !== "platform_admin") redirect("/admin/dashboard")
  return session
}

export async function createCodeAction(
  _prev: { error?: string } | undefined,
  formData: FormData
): Promise<{ error?: string }> {
  const session = await requirePlatformAdmin()
  const code = (formData.get("code") as string).trim().toUpperCase()
  const discountType = formData.get("discountType") as "fee_percentage" | "fee_waiver"
  const discountValue = parseInt(formData.get("discountValue") as string, 10)
  const maxUses = formData.get("maxUses") ? parseInt(formData.get("maxUses") as string, 10) : null
  const campaignLimit = formData.get("campaignLimit") ? parseInt(formData.get("campaignLimit") as string, 10) : null
  const expiresAtStr = formData.get("expiresAt") as string
  const expiresAt = expiresAtStr ? new Date(expiresAtStr) : null

  if (!code) return { error: "Code is required" }
  if (discountType !== "fee_percentage" && discountType !== "fee_waiver") {
    return { error: "Invalid discount type" }
  }
  if (isNaN(discountValue) || discountValue < 1 || discountValue > 100) {
    return { error: "Discount value must be between 1 and 100" }
  }

  await createDiscountCode({
    code,
    discountType,
    discountValue,
    maxUses,
    campaignLimit,
    expiresAt,
    createdBy: session.user.id,
  })
  redirect("/admin/discount-codes")
}

export async function deactivateCodeAction(id: string): Promise<void> {
  await requirePlatformAdmin()
  await deactivateDiscountCode(id)
  revalidatePath("/admin/discount-codes")
  revalidatePath("/admin/dashboard")
}
