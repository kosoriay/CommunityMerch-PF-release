import { db } from "@/lib/db/client"
import { campaigns, campaignProducts, designs, organizations } from "@/lib/db/schema"
import { and, count, desc, eq, inArray, ne } from "drizzle-orm"
import { getActiveCodeForOrg, getPlatformFeeRate } from "@/lib/discount-codes"
import { r2KeyFromUrl, deleteFromR2 } from "@/lib/providers/r2"

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
    closedAt: null,
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

/**
 * For the public page. Hides drafts only.
 *
 * A campaign that has ended keeps its URL. Returning nothing would break every
 * link already sent to a mailing list or posted to a class group, and the page
 * is where supporters find out how it went.
 */
export async function getCampaignBySlug(slug: string) {
  return db.query.campaigns.findFirst({
    where: and(eq(campaigns.slug, slug), ne(campaigns.status, "draft")),
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

/**
 * The R2 key of a design file that a save is about to orphan, or null when
 * there is nothing to clean up.
 *
 * Returning null when the URL is unchanged is the point of this function: the
 * design form resubmits the same hidden URL on every save, so an unconditional
 * delete would destroy the design the campaign is currently showing.
 *
 * `r2KeyFromUrl` returns null for anything outside our bucket, which keeps the
 * dev fallback (`public/uploads/`) and any external URL out of reach.
 */
export function supersededDesignKey(
  oldUrl: string | null | undefined,
  newUrl: string | null | undefined
): string | null {
  if (!oldUrl || oldUrl === newUrl) return null
  return r2KeyFromUrl(oldUrl)
}

export async function saveDesignStep(
  campaignId: string,
  designFileUrl: string | null,
  mockupUrl?: string | null
): Promise<void> {
  const now = new Date()
  // Captured before the write so the old file can be removed afterwards.
  // Replacing a design used to leave the previous upload in the bucket with
  // nothing pointing at it.
  let orphanedKey: string | null = null

  await db.transaction(async (tx) => {
    await tx
      .update(campaigns)
      .set({ updatedAt: now })
      .where(eq(campaigns.id, campaignId))

    const existing = await tx.query.designs.findFirst({
      where: eq(designs.campaignId, campaignId),
    })
    if (existing) {
      orphanedKey = supersededDesignKey(existing.designFileUrl, designFileUrl)
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

  // After the commit, never inside it: a save that fails must not take the
  // file with it, and a storage failure must not fail a save that succeeded.
  // `mockupUrl` is deliberately untouched — those are Printful's files.
  if (orphanedKey) await deleteFromR2([orphanedKey])
}

export type ProductInput = {
  printfulVariantId: string
  retailPrice: number
  podCost: number
  displayOrder: number
  availableColors: string[]
}

/**
 * 価格ステップの保存。
 *
 * 以前は campaign_products を全行 DELETE して再 INSERT していた。2通りに壊れる。
 *
 * (A) モックアップ列が再 INSERT の値に無いので、**価格を1円直すだけで生成済みの
 *     モックアップが全部消えた。** 生成は成功しているので警告も出ない。
 * (B) order_items.campaign_product_id は ON DELETE NO ACTION（schema.ts:211）で
 *     外部キーは有効（実測 PRAGMA foreign_keys = 1）。参照されている行があると
 *     DELETE が FOREIGN KEY constraint failed を投げ、**保存が丸ごと失敗した。**
 *     引き金は「売れたこと」ではなく order_items に行があることで、
 *     createPendingOrder は Stripe セッションより前にその行を pending で書く。
 *     **買い手が Checkout を押して立ち去るだけで団体は締め出された。**
 *     savePricingAction（pricing/_actions.ts:70）は try/catch していないので、
 *     団体には原因を説明しない汎用エラーしか出なかった。
 *
 * upsert は campaign_products.id を保存するので、参照されている行を削除しない。
 * (A) と (B) の両方が直る。
 */
export async function savePricingStep(
  campaignId: string,
  productList: ProductInput[],
  goalAmount: number | null,
  deadline: Date | null,
  amountDisplayMode: "percent_only" | "show_amount"
): Promise<void> {
  const now = new Date()
  await db.transaction(async (tx) => {
    const existing = await tx.select().from(campaignProducts)
      .where(eq(campaignProducts.campaignId, campaignId))

    const keep = new Set(productList.map((p) => p.printfulVariantId))

    // 1. 選択から外れた商品の行だけを消す。残る行は触らない。
    const toDelete = existing.filter((row) => !keep.has(row.printfulVariantId))
    if (toDelete.length > 0) {
      await tx.delete(campaignProducts).where(inArray(campaignProducts.id, toDelete.map((r) => r.id)))
    }

    const byVariant = new Map(existing.map((r) => [r.printfulVariantId, r]))

    for (const p of productList) {
      const row = byVariant.get(p.printfulVariantId)
      if (!row) {
        await tx.insert(campaignProducts).values({
          id: crypto.randomUUID(),
          campaignId,
          printfulVariantId: p.printfulVariantId,
          retailPrice: p.retailPrice,
          podCost: p.podCost,
          displayOrder: p.displayOrder,
          availableColors: JSON.stringify(p.availableColors),
        })
        continue
      }

      const before = JSON.parse(row.availableColors) as string[]
      const after = p.availableColors
      const removed = before.filter((c) => !after.includes(c))
      const added = after.filter((c) => !before.includes(c))

      // 2. 落ちた色のモックアップは使えないので捨てる。他は素通し。
      let nextMockupUrls = row.mockupUrls
      if (removed.length > 0 && row.mockupUrls) {
        const map = JSON.parse(row.mockupUrls) as Record<string, string>
        for (const color of removed) delete map[color]
        nextMockupUrls = Object.keys(map).length > 0 ? JSON.stringify(map) : null
      }

      // 3. 価格・原価・並び・色だけ更新する。**mockupUrl と mockupGeneratedAt には
      //    触らない**（色が増えた場合を除く）。ここが (A) の修正である。
      await tx.update(campaignProducts).set({
        retailPrice: p.retailPrice,
        podCost: p.podCost,
        displayOrder: p.displayOrder,
        availableColors: JSON.stringify(after),
        mockupUrls: nextMockupUrls,
        // 色が増えたら再生成待ちにする。これを拾うのは cron 分岐4（Task 10）で
        // あり、既存2本は isNotNull で絞るので NULL は掛からない（設計 §8.6）。
        ...(added.length > 0 ? { mockupGeneratedAt: null } : {}),
      }).where(eq(campaignProducts.id, row.id))
    }

    await tx.update(campaigns)
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
  if (campaign.org.closedAt) {
    return { error: "This organization is closed. Contact support to reopen it before publishing." }
  }

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
