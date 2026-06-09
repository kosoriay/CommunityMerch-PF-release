"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { suspendOrg, unsuspendOrg, setInternalOrg } from "@/lib/admin"
import { applyDiscountCodeToOrg, removeDiscountCodeFromOrg } from "@/lib/discount-codes"

async function requirePlatformAdmin() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (session?.user.platformRole !== "platform_admin") redirect("/admin/dashboard")
  return session
}

export async function suspendOrgAction(orgId: string): Promise<void> {
  await requirePlatformAdmin()
  await suspendOrg(orgId)
  revalidatePath(`/admin/orgs/${orgId}`)
  revalidatePath("/admin/orgs")
  revalidatePath("/admin/dashboard")
}

export async function unsuspendOrgAction(orgId: string): Promise<void> {
  await requirePlatformAdmin()
  await unsuspendOrg(orgId)
  revalidatePath(`/admin/orgs/${orgId}`)
  revalidatePath("/admin/orgs")
  revalidatePath("/admin/dashboard")
}

export async function toggleInternalAction(orgId: string, isInternal: boolean): Promise<void> {
  await requirePlatformAdmin()
  await setInternalOrg(orgId, isInternal)
  revalidatePath(`/admin/orgs/${orgId}`)
  revalidatePath("/admin/orgs")
}

export async function applyCodeAction(
  orgId: string,
  code: string
): Promise<{ error?: string }> {
  await requirePlatformAdmin()
  return applyDiscountCodeToOrg(orgId, code)
}

export async function applyCodeFormAction(
  orgId: string,
  formData: FormData
): Promise<void> {
  await requirePlatformAdmin()
  const code = (formData.get("code") as string ?? "").trim()
  if (!code) return
  await applyDiscountCodeToOrg(orgId, code)
  revalidatePath(`/admin/orgs/${orgId}`)
}

export async function removeCodeAction(orgId: string): Promise<void> {
  await requirePlatformAdmin()
  await removeDiscountCodeFromOrg(orgId)
  revalidatePath(`/admin/orgs/${orgId}`)
}
