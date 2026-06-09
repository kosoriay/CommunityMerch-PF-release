"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { requireOrgAccess } from "@/lib/middleware/require-org-access"
import { getCampaign, saveDesignStep } from "@/lib/campaigns"

export async function saveDesignAction(
  orgId: string,
  campaignId: string,
  _prevState: { error?: string } | undefined,
  formData: FormData
): Promise<{ error?: string }> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/sign-in")

  try {
    await requireOrgAccess(session.user.id, orgId, "member")
  } catch {
    return { error: "Access denied" }
  }

  const campaign = await getCampaign(campaignId)
  if (!campaign || campaign.orgId !== orgId) return { error: "Campaign not found" }

  const designFileUrl = (formData.get("designFileUrl") as string | null) || null
  const mockupUrl = (formData.get("mockupUrl") as string | null) || null

  await saveDesignStep(campaignId, designFileUrl, mockupUrl)
  redirect(`/dashboard/orgs/${orgId}/campaigns/${campaignId}/pricing`)
}
