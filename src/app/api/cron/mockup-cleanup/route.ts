import { NextResponse } from "next/server"
import { db } from "@/lib/db/client"
import { campaigns, campaignProducts, designs } from "@/lib/db/schema"
import { and, eq, lt, isNotNull, gt } from "drizzle-orm"
import { generateCampaignMockups } from "@/lib/mockup-generator"

export async function GET(req: Request): Promise<NextResponse> {
  const authHeader = req.headers.get("Authorization")
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const now = new Date()
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)

  // 1. Clear mockups for campaigns closed 14+ days ago
  const closedCampaigns = await db
    .select({ id: campaigns.id })
    .from(campaigns)
    .where(and(eq(campaigns.status, "closed"), lt(campaigns.updatedAt, fourteenDaysAgo)))

  for (const campaign of closedCampaigns) {
    await db
      .update(campaignProducts)
      .set({ mockupUrl: null, mockupGeneratedAt: null })
      .where(
        and(
          eq(campaignProducts.campaignId, campaign.id),
          isNotNull(campaignProducts.mockupUrl)
        )
      )
  }

  // 2. Re-generate for active campaigns with mockups older than 60 days
  const staleCampaigns = await db
    .select({ id: campaigns.id })
    .from(campaigns)
    .innerJoin(campaignProducts, eq(campaignProducts.campaignId, campaigns.id))
    .where(
      and(
        eq(campaigns.status, "active"),
        isNotNull(campaignProducts.mockupGeneratedAt),
        lt(campaignProducts.mockupGeneratedAt, sixtyDaysAgo)
      )
    )

  const staleSeen = new Set<string>()
  for (const campaign of staleCampaigns) {
    if (!staleSeen.has(campaign.id)) {
      staleSeen.add(campaign.id)
      await generateCampaignMockups(campaign.id)
    }
  }

  // 3. Re-generate for active campaigns where design was updated after last mockup generation
  const designUpdatedCampaigns = await db
    .select({ id: campaigns.id })
    .from(campaigns)
    .innerJoin(campaignProducts, eq(campaignProducts.campaignId, campaigns.id))
    .innerJoin(designs, eq(designs.campaignId, campaigns.id))
    .where(
      and(
        eq(campaigns.status, "active"),
        isNotNull(campaignProducts.mockupGeneratedAt),
        gt(designs.updatedAt, campaignProducts.mockupGeneratedAt)
      )
    )

  const updatedSeen = new Set<string>()
  for (const campaign of designUpdatedCampaigns) {
    if (!updatedSeen.has(campaign.id) && !staleSeen.has(campaign.id)) {
      updatedSeen.add(campaign.id)
      await generateCampaignMockups(campaign.id)
    }
  }

  return NextResponse.json({ ok: true })
}
