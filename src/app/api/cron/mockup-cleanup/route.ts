import { NextResponse } from "next/server"
import { db } from "@/lib/db/client"
import { campaigns, campaignProducts, designs } from "@/lib/db/schema"
import { and, eq, lt, isNotNull, isNull, gt, or } from "drizzle-orm"
import { generateCampaignMockups } from "@/lib/mockup-generator"
import { materializeExpiredCampaigns } from "@/lib/campaign-lifecycle"
import { sweepOrphanedUploads } from "@/lib/orphaned-uploads"
import { sweepExpiredOrderPII } from "@/lib/order-pii"

export async function GET(req: Request): Promise<NextResponse> {
  const authHeader = req.headers.get("Authorization")
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const now = new Date()
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)

  // 0. Write back campaigns whose deadline has passed. Selling is already
  //    stopped by isSellingOpen at checkout — this is the record catching up,
  //    which the dashboard grouping and step 1 below both read. Idempotent, and
  //    harmless if it runs late.
  const closedByDeadline = await materializeExpiredCampaigns(now)

  // Design images are written to R2 before any row references them, so leaving
  // the wizard strands the file. The seven-day grace period means an upload
  // waiting on an unsaved form is never in scope.
  const orphanSweep = await sweepOrphanedUploads(now)

  // Buyer names, emails, addresses and tracking numbers are cleared once the
  // retention window closes. Amounts and campaign links stay, so revenue history
  // and Stripe reconciliation are unaffected.
  const piiSweep = await sweepExpiredOrderPII(now)

  // 1. Clear mockups for campaigns closed 14+ days ago
  const closedCampaigns = await db
    .select({ id: campaigns.id })
    .from(campaigns)
    // Measured from closedAt, not updatedAt: editing a finished campaign would
    // otherwise push the cleanup back another fortnight each time.
    .where(and(eq(campaigns.status, "closed"), lt(campaigns.closedAt, fourteenDaysAgo)))

  for (const campaign of closedCampaigns) {
    await db
      .update(campaignProducts)
      .set({ mockupUrl: null, mockupUrls: null, mockupGeneratedAt: null })
      .where(
        and(
          eq(campaignProducts.campaignId, campaign.id),
          // 代表色の生成だけが失敗した行は mockup_urls にしか値が無い。
          // mockupUrl だけで絞ると永久に掃除されない（設計 §8.5）。
          or(isNotNull(campaignProducts.mockupUrl), isNotNull(campaignProducts.mockupUrls))
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
      // 60日超で既に mockupGeneratedAt が付いている行を選んでいる。force なしでは
      // generateCampaignMockups 自身のガードに弾かれ、この分岐は何もしない。
      await generateCampaignMockups(campaign.id, { force: true })
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
      // 同上。この分岐が選ぶ行も mockupGeneratedAt 済みで、force が無いと
      // 新しいロゴがアップロードされても古いモックアップが永久に残る。
      await generateCampaignMockups(campaign.id, { force: true })
    }
  }

  // 4. Never generated. savePricingStep marks a product this way when the
  //    organisation adds a colour, and a freshly published campaign starts here.
  //    Paths 2 and 3 both filter on isNotNull(mockupGeneratedAt), so a null row
  //    falls through both and would otherwise never be picked up at all.
  //
  //    mockupAttemptedAt is what makes this converge. A beanie is skipped on
  //    purpose (its print area is not modelled — see mockup-generator.ts), so its
  //    mockupGeneratedAt stays null forever. Without the attempt stamp this branch
  //    would re-select that campaign every single day and overwrite the tee's
  //    working mockups alongside it. With it, a skipped row is retried weekly.
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const neverGenerated = await db
    .select({ id: campaigns.id })
    .from(campaigns)
    .innerJoin(campaignProducts, eq(campaignProducts.campaignId, campaigns.id))
    .innerJoin(designs, eq(designs.campaignId, campaigns.id))
    .where(
      and(
        eq(campaigns.status, "active"),
        isNull(campaignProducts.mockupGeneratedAt),
        or(
          isNull(campaignProducts.mockupAttemptedAt),
          lt(campaignProducts.mockupAttemptedAt, sevenDaysAgo)
        ),
        isNotNull(designs.designFileUrl)
      )
    )

  for (const campaign of neverGenerated) {
    if (!staleSeen.has(campaign.id) && !updatedSeen.has(campaign.id)) {
      updatedSeen.add(campaign.id)
      await generateCampaignMockups(campaign.id)
    }
  }

  return NextResponse.json({
    ok: true,
    closedByDeadline,
    orphanedUploadsDeleted: orphanSweep.deleted,
    ordersAnonymized: piiSweep.anonymized,
  })
}
