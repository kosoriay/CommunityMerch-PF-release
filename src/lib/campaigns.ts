import { db } from "@/lib/db/client"
import { campaigns, campaignProducts, designs, organizations } from "@/lib/db/schema"
import { and, count, desc, eq } from "drizzle-orm"
import { getActiveCodeForOrg, getPlatformFeeRate } from "@/lib/discount-codes"

const RESERVED_SLUGS = new Set(["dashboard", "sign-in", "invite", "api", "uploads"])

export function generateCampaignSlug(title: string, year: number): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 40)
  const slug = `${base}-${year}`
  return RESERVED_SLUGS.has(base) ? `campaign-${slug}` : slug
}

export async function createCampaign(
  orgId: string,
  title: string
): Promise<typeof campaigns.$inferSelect> {
  const id = crypto.randomUUID()
  const now = new Date()
  const year = now.getFullYear()

  let slug = generateCampaignSlug(title, year)
  const existing = await db.query.campaigns.findFirst({
    where: eq(campaigns.slug, slug),
  })
  if (existing) {
    slug = `${slug}-${Date.now().toString(36)}`
  }

  await db.insert(campaigns).values({
    id,
    orgId,
    title,
    slug,
    status: "draft",
    createdAt: now,
    updatedAt: now,
  })

  return {
    id,
    orgId,
    title,
    slug,
    status: "draft",
    goalAmount: null,
    deadline: null,
    amountDisplayMode: "percent_only",
    platformFeeRate: 900,
    appliedDiscountCodeId: null,
    createdAt: now,
    updatedAt: now,
  }
}

export async function getCampaign(campaignId: string) {
  return db.query.campaigns.findFirst({
    where: eq(campaigns.id, campaignId),
    with: { products: true, design: true },
  })
}

export async function getCampaignBySlug(slug: string) {
  return db.query.campaigns.findFirst({
    where: and(eq(campaigns.slug, slug), eq(campaigns.status, "active")),
    with: { products: true, design: true, org: true },
  })
}

export async function getCampaignsByOrg(orgId: string) {
  return db.query.campaigns.findMany({
    where: eq(campaigns.orgId, orgId),
    orderBy: desc(campaigns.createdAt),
    with: { products: true },
  })
}

export async function saveDesignStep(
  campaignId: string,
  designFileUrl: string | null,
  mockupUrl?: string | null
): Promise<void> {
  const now = new Date()
  await db.transaction(async (tx) => {
    await tx
      .update(campaigns)
      .set({ updatedAt: now })
      .where(eq(campaigns.id, campaignId))

    const existing = await tx.query.designs.findFirst({
      where: eq(designs.campaignId, campaignId),
    })
    if (existing) {
      await tx
        .update(designs)
        .set({
          designFileUrl,
          mockupUrl: mockupUrl ?? existing.mockupUrl,
          updatedAt: now,
        })
        .where(eq(designs.campaignId, campaignId))
    } else {
      await tx.insert(designs).values({
        id: crypto.randomUUID(),
        campaignId,
        designFileUrl,
        mockupUrl: mockupUrl ?? null,
        aiGenerated: false,
        createdAt: now,
        updatedAt: now,
      })
    }
  })
}

export type ProductInput = {
  printfulVariantId: string
  retailPrice: number
  podCost: number
  displayOrder: number
  availableColors?: string[]
}

export async function savePricingStep(
  campaignId: string,
  productList: ProductInput[],
  goalAmount: number | null,
  deadline: Date | null,
  amountDisplayMode: "percent_only" | "show_amount"
): Promise<void> {
  const now = new Date()
  await db.transaction(async (tx) => {
    await tx.delete(campaignProducts).where(eq(campaignProducts.campaignId, campaignId))
    for (const p of productList) {
      await tx.insert(campaignProducts).values({
        id: crypto.randomUUID(),
        campaignId,
        printfulVariantId: p.printfulVariantId,
        retailPrice: p.retailPrice,
        podCost: p.podCost,
        displayOrder: p.displayOrder,
        availableColors: JSON.stringify(p.availableColors ?? ["White"]),
      })
    }
    await tx
      .update(campaigns)
      .set({ goalAmount, deadline, amountDisplayMode, updatedAt: now })
      .where(eq(campaigns.id, campaignId))
  })
}

export async function publishCampaign(campaignId: string): Promise<{ error?: string }> {
  const campaign = await db.query.campaigns.findFirst({
    where: eq(campaigns.id, campaignId),
    with: { org: true },
  })
  if (!campaign) return { error: "Campaign not found" }
  if (campaign.org.suspendedAt) return { error: "Your account has been suspended. Contact support." }

  let discountCode = await getActiveCodeForOrg(campaign.orgId)

  // fee_waiver + campaignLimit: check if this org has already used up their free campaign slots
  if (discountCode?.discountType === "fee_waiver" && discountCode.campaignLimit !== null) {
    const [{ usedCount }] = await db
      .select({ usedCount: count() })
      .from(campaigns)
      .where(and(
        eq(campaigns.orgId, campaign.orgId),
        eq(campaigns.appliedDiscountCodeId, discountCode.id)
      ))
    if (usedCount >= discountCode.campaignLimit) {
      discountCode = null // limit reached — fall back to standard 9% rate
    }
  }

  const feeRate = getPlatformFeeRate(campaign.org, discountCode)
  const platformFeeRate = Math.round(feeRate * 10000) // basis points (0.09 → 900)

  await db.update(campaigns)
    .set({
      status: "active",
      platformFeeRate,
      appliedDiscountCodeId: discountCode?.id ?? null,
      updatedAt: new Date(),
    })
    .where(eq(campaigns.id, campaignId))
  return {}
}

// organizations is imported to ensure Drizzle relation types resolve for `with: { org: true }`
void organizations
