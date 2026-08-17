"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { after } from "next/server"
import { auth } from "@/lib/auth"
import { requireOrgAccess } from "@/lib/middleware/require-org-access"
import { getCampaign, publishCampaign } from "@/lib/campaigns"
import { closeCampaign, reopenCampaign, canReopen } from "@/lib/campaign-lifecycle"
import { isOrgClosed } from "@/lib/org-lifecycle"
import { generateCampaignMockups } from "@/lib/mockup-generator"
import { db } from "@/lib/db/client"
import { organizations } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

export async function publishCampaignAction(
  orgId: string,
  campaignId: string
): Promise<void> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/sign-in")

  try {
    await requireOrgAccess(session.user.id, orgId, "admin")
  } catch {
    redirect(`/dashboard/orgs/${orgId}/campaigns/${campaignId}/publish?error=forbidden`)
  }

  const campaign = await getCampaign(campaignId)
  if (!campaign || campaign.orgId !== orgId) {
    redirect(`/dashboard/orgs/${orgId}/campaigns/${campaignId}/publish?error=not-found`)
  }
  if (campaign.products.length === 0) {
    redirect(`/dashboard/orgs/${orgId}/campaigns/${campaignId}/publish?error=no-products`)
  }
  // A design is what gets printed — without one, paid orders cannot be
  // fulfilled (they stall as "manual fulfillment required").
  if (!campaign.design?.designFileUrl) {
    redirect(`/dashboard/orgs/${orgId}/campaigns/${campaignId}/publish?error=no-design`)
  }

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, orgId),
  })
  if (!org?.stripeOnboardingComplete) {
    redirect(`/dashboard/orgs/${orgId}/settings/payouts`)
  }

  const result = await publishCampaign(campaignId)
  if (result.error) redirect(`/dashboard/orgs/${orgId}/campaigns/${campaignId}/publish?error=${encodeURIComponent(result.error)}`)

  after(() => generateCampaignMockups(campaignId))
  redirect(`/dashboard/orgs/${orgId}/campaigns/${campaignId}/publish?published=1`)
}

export type LifecycleState = { error?: string; success?: string } | undefined

/** Throws rather than redirecting, so the caller can answer in the form. */
async function requireCampaignAdmin(orgId: string, campaignId: string) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/sign-in")
  await requireOrgAccess(session.user.id, orgId, "admin")

  const campaign = await getCampaign(campaignId)
  if (!campaign || campaign.orgId !== orgId) throw new Error("not-found")
  return campaign
}

/**
 * Stop selling. Orders already placed are untouched — they are printed and
 * shipped regardless, so ending is not a cancellation of anything.
 */
export async function closeCampaignAction(
  orgId: string,
  campaignId: string,
  _prev: LifecycleState,
  formData: FormData
): Promise<LifecycleState> {
  let campaign
  try {
    campaign = await requireCampaignAdmin(orgId, campaignId)
  } catch {
    return { error: "Only an organization admin can end this campaign." }
  }

  const typed = (formData.get("confirmation") as string | null)?.trim() ?? ""
  if (typed !== campaign.title) {
    return { error: "Type the campaign title exactly to confirm." }
  }

  const result = await closeCampaign(campaignId)
  if (!result.ok) return { error: result.error }

  revalidatePath(`/dashboard/orgs/${orgId}/campaigns/${campaignId}/publish`)
  revalidatePath(`/${campaign.slug}`)
  return { success: "This campaign has ended. Orders already placed are unaffected." }
}

export async function reopenCampaignAction(
  orgId: string,
  campaignId: string,
  _prev: LifecycleState,
  formData: FormData
): Promise<LifecycleState> {
  let campaign
  try {
    campaign = await requireCampaignAdmin(orgId, campaignId)
  } catch {
    return { error: "Only an organization admin can reopen this campaign." }
  }

  const raw = (formData.get("deadline") as string | null)?.trim() ?? ""
  const deadline = raw ? new Date(raw) : null
  if (deadline !== null && Number.isNaN(deadline.getTime())) {
    return { error: "That deadline is not a valid date." }
  }

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, orgId),
  })
  if (!org) return { error: "Organization not found." }

  const allowed = canReopen({
    orgClosed: isOrgClosed(org),
    orgSuspended: org.suspendedAt !== null,
    deadline,
    now: new Date(),
  })
  if (!allowed.ok) return { error: allowed.error }

  const result = await reopenCampaign(campaignId, deadline)
  if (!result.ok) return { error: result.error }

  revalidatePath(`/dashboard/orgs/${orgId}/campaigns/${campaignId}/publish`)
  revalidatePath(`/${campaign.slug}`)
  return { success: "This campaign is open again." }
}
