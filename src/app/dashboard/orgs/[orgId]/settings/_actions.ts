"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { requireOrgAccess } from "@/lib/middleware/require-org-access"
import { validateOrgName, updateOrgName } from "@/lib/orgs"

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
