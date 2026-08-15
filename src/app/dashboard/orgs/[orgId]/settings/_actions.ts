"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { requireOrgAccess } from "@/lib/middleware/require-org-access"
import { validateOrgName, updateOrgName, getOrg } from "@/lib/orgs"
import { deleteOrgCascade, closeOrg, confirmationMatches } from "@/lib/org-lifecycle"

type State = { error?: string; success?: boolean } | undefined

export async function updateOrgAction(orgId: string, _prevState: State, formData: FormData): Promise<State> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/sign-in")

  try {
    await requireOrgAccess(session.user.id, orgId, "admin")
  } catch {
    return { error: "You don't have permission to edit this organization." }
  }

  const result = validateOrgName(formData.get("name") as string | null)
  if ("error" in result) return { error: result.error }

  await updateOrgName(orgId, result.value)
  revalidatePath(`/dashboard/orgs/${orgId}`)
  revalidatePath(`/dashboard/orgs/${orgId}/settings`)
  return { success: true }
}

export type DangerZoneState = { error?: string; success?: string } | undefined

async function requireOrgAdmin(orgId: string) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/sign-in")
  await requireOrgAccess(session.user.id, orgId, "admin")
  return session
}

/**
 * Permanently delete an organization. Organization admins only, and only while
 * the organization has never taken an order — `deleteOrgCascade` re-checks
 * that itself, so a checkout completing while this page was open cannot slip
 * a paid order past the confirmation.
 */
export async function deleteOrgAction(
  orgId: string,
  _prev: DangerZoneState,
  formData: FormData
): Promise<DangerZoneState> {
  try {
    await requireOrgAdmin(orgId)
  } catch {
    return { error: "Only an organization admin can delete this organization." }
  }

  const org = await getOrg(orgId)
  if (!org) return { error: "Organization not found." }

  if (!confirmationMatches(String(formData.get("confirmation") ?? ""), org.name)) {
    return { error: "Type the organization name exactly to confirm." }
  }

  const result = await deleteOrgCascade(orgId)
  if (!result.ok) return { error: result.error }

  revalidatePath("/dashboard")
  redirect("/dashboard?deleted=1")
}

/** Retire an organization that has orders. Its records are kept. */
export async function closeOrgAction(
  orgId: string,
  _prev: DangerZoneState,
  formData: FormData
): Promise<DangerZoneState> {
  try {
    await requireOrgAdmin(orgId)
  } catch {
    return { error: "Only an organization admin can close this organization." }
  }

  const org = await getOrg(orgId)
  if (!org) return { error: "Organization not found." }

  if (!confirmationMatches(String(formData.get("confirmation") ?? ""), org.name)) {
    return { error: "Type the organization name exactly to confirm." }
  }

  const result = await closeOrg(orgId)
  if (!result.ok) return { error: result.error }

  revalidatePath(`/dashboard/orgs/${orgId}`)
  revalidatePath("/dashboard")
  return { success: "Organization closed. Campaigns are no longer public and orders are refused." }
}
