"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { requireOrgAccess } from "@/lib/middleware/require-org-access"
import { createCampaign } from "@/lib/campaigns"

type ActionState = { error?: string } | undefined

export async function createCampaignAction(
  orgId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/sign-in")

  try {
    await requireOrgAccess(session.user.id, orgId, "member")
  } catch {
    redirect(`/dashboard/orgs/${orgId}`)
  }

  const title = (formData.get("title") as string | null)?.trim() ?? ""
  if (!title || title.length < 2) return { error: "Campaign name must be at least 2 characters." }
  if (title.length > 100) return { error: "Campaign name must be 100 characters or fewer." }

  const campaign = await createCampaign(orgId, title)
  redirect(`/dashboard/orgs/${orgId}/campaigns/${campaign.id}/design`)
}
