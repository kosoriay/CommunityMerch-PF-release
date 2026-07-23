"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { after } from "next/server"
import { auth } from "@/lib/auth"
import { requireOrgAccess } from "@/lib/middleware/require-org-access"
import { getCampaign, publishCampaign } from "@/lib/campaigns"
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
