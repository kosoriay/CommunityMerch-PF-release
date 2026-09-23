import { NextResponse } from "next/server"
import { db } from "@/lib/db/client"
import { campaigns, campaignProducts, designs } from "@/lib/db/schema"
import { and, eq, lt, isNotNull, isNull, gt, or, inArray } from "drizzle-orm"
import { generateCampaignMockups } from "@/lib/mockup-generator"
import { materializeExpiredCampaigns } from "@/lib/campaign-lifecycle"
import { sweepOrphanedUploads } from "@/lib/orphaned-uploads"
import { sweepExpiredOrderPII } from "@/lib/order-pii"
import { needsRehost, referencedKeysFrom, acceptableMockupUrl } from "@/lib/r2-keys"
import { r2PublicUrlOrNull, deleteFromR2 } from "@/lib/providers/r2"
import { reconcilePrintfulStatuses, type ReconcileResult } from "@/lib/printful-reconcile"

// 最終レビュー指摘：この route には maxDuration の指定が無かった。Printful の照会
// （PRINTFUL_RECONCILE_TIME_BUDGET_MS = 60秒）を**どの分岐よりも先に**独立して走らせた
// 後、キャンペーンの締切処理・PII 掃除・モックアップの再生成（商品1点あたり最大30秒の
// ポーリングを含む）が直列に続く（設計 §5.5）。明示しないまま Vercel のプロジェクト側の
// 既定値が変わると、後ろの分岐が時間切れで実行されない日が出かねない。300秒は現行の
// Hobby プランでの上限（デフォルトでもある）で、照会の60秒を引いた約240秒を残りの
// 分岐に残す。
export const maxDuration = 300

export async function GET(req: Request): Promise<NextResponse> {
  const authHeader = req.headers.get("Authorization")
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const now = new Date()

  // Printful 側の状態の照会（設計 2026-09-21 §5.5）。**どの分岐よりも先に、独立して**
  // 走らせる。以下の分岐は try の無い直列の await で分離されておらず、後ろに置くと
  // 前の分岐の throw やモックアップの長いポーリングで照会が走らない日が出る。
  let printfulReconcile: ReconcileResult | { error: string }
  try {
    printfulReconcile = await reconcilePrintfulStatuses(now)
  } catch (err) {
    console.error("[cron] Printful status reconcile failed:", err)
    printfulReconcile = { error: err instanceof Error ? err.message : String(err) }
  }

  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)
  // 分岐2（コード側の damping）と分岐4（SQL 側）が同じ窓を使う
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

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

  // 規約 4.6 の用途制限に対するガード。キャンペーンのモックアップを消すのと同じ
  // タイミングで R2 のコピーも消し、保持を必要な期間に限る（設計 §8.1）。
  //
  // **列を NULL にする前に消す。** あとでは、どのキーを消すべきか分からなくなる。
  let mockupObjectsDeleted = 0
  const publicUrlForCleanup = r2PublicUrlOrNull()

  for (const campaign of closedCampaigns) {
    // **SELECT と UPDATE は必ず同じ述語で。** 別々に書くと、将来 UPDATE 側だけが
    // 狭められたときに R2 のコピーだけ消えて列が生き残る。その列は R2 のURLなので
    // needsRehost は false を返し、分岐2は永久にその行を直さない（レビュー M1）。
    const hasAnyMockup = and(
      eq(campaignProducts.campaignId, campaign.id),
      // 代表色の生成だけが失敗した行は mockup_urls にしか値が無い。
      // mockupUrl だけで絞ると永久に掃除されない（設計 §8.5）。
      or(isNotNull(campaignProducts.mockupUrl), isNotNull(campaignProducts.mockupUrls))
    )

    const rows = await db
      .select({
        id: campaignProducts.id,
        url: campaignProducts.mockupUrl,
        urls: campaignProducts.mockupUrls,
      })
      .from(campaignProducts)
      .where(hasAnyMockup)

    const keys = [...referencedKeysFrom(
      rows.flatMap((row) => [row.url, row.urls]),
      publicUrlForCleanup
    )]
    if (keys.length > 0) {
      // best-effort。失敗しても列の NULL 化は続ける（残りは孤児掃除が回収する）
      mockupObjectsDeleted += (await deleteFromR2(keys)).deleted
    }

    await db
      .update(campaignProducts)
      .set({ mockupUrl: null, mockupUrls: null, mockupGeneratedAt: null })
      .where(hasAnyMockup)
  }

  // 1.5. designs.mockup_url has no regeneration path anywhere in the codebase —
  //      it is written only by saveDesignStep (src/lib/campaigns.ts:150,159).
  //      A row saved before the R2 rehost (v1.21.0) is stuck holding a dead
  //      Printful URL forever. The public hero image already falls back to the
  //      uploaded design file on load error, so clearing the column here does
  //      not regenerate anything — it just stops the guaranteed-failing
  //      request and removes the dangling value as a trap for future code that
  //      renders it without an onError handler.
  //
  //      Filter in JS, not SQL: a LIKE against the public URL would treat any
  //      `_` it contains as a single-character wildcard, and a loosened match
  //      would null out a value that IS already on our host — destroying a
  //      good preview. Same reasoning as branch 2's rot check above.
  //
  //      acceptableMockupUrl(url, null) is true for every url, so with R2
  //      unconfigured (publicUrlForCleanup is null) nothing here is ever
  //      unacceptable and this step is a no-op. Rely on that instead of a
  //      second guard.
  const designsWithMockup = await db
    .select({ id: designs.id, mockupUrl: designs.mockupUrl })
    .from(designs)
    .where(isNotNull(designs.mockupUrl))

  const deadDesignMockupIds = designsWithMockup
    .filter((row) => !acceptableMockupUrl(row.mockupUrl, publicUrlForCleanup))
    .map((row) => row.id)

  let designMockupUrlsCleared = 0
  if (deadDesignMockupIds.length > 0) {
    await db
      .update(designs)
      .set({ mockupUrl: null })
      .where(inArray(designs.id, deadDesignMockupIds))
    designMockupUrlsCleared = deadDesignMockupIds.length
  }

  // 2. Re-generate for active campaigns whose mockups are no good any more.
  //
  //    Two reasons a row qualifies, and the second is why this exists at all:
  //    the 60-day staleness window, and a row still pointing at Printful's
  //    temporary bucket. Those URLs die in about ten days (設計 2026-09-11 §1),
  //    so a 60-day-only rule left the image broken for up to fifty days.
  //
  //    The rot check runs in code, not SQL: mockup_urls is a JSON string, and a
  //    LIKE pattern loosens as soon as the public URL contains an underscore.
  const publicUrl = r2PublicUrlOrNull()
  const activeWithMockups = await db
    .select({
      id: campaigns.id,
      generatedAt: campaignProducts.mockupGeneratedAt,
      urls: campaignProducts.mockupUrls,
      attemptedAt: campaignProducts.mockupAttemptedAt,
    })
    .from(campaigns)
    .innerJoin(campaignProducts, eq(campaignProducts.campaignId, campaigns.id))
    .where(
      and(
        eq(campaigns.status, "active"),
        isNotNull(campaignProducts.mockupGeneratedAt)
      )
    )

  //    貼り替えが恒久的に失敗する行（Printful 4xx・デザインファイル欠損・R2 PUT の
  //    失敗）では stamp() が mockupAttemptedAt だけを更新し、mockup_urls と
  //    mockup_generated_at は腐ったまま残る。述語が真のままなので、この分岐は毎晩
  //    再点火し、健康な兄弟色まで作り直して R2 のオブジェクトを毎晩1つ増やす。
  //    分岐4と同じ damping を掛け、週1の再試行にする（レビュー I3）。
  //
  //    **damping は needsRehost の腕だけに掛ける。** 60日の腕は「腐っている」ではなく
  //    「古い」を見る条件で、それが毎晩再点火するのはこのブランチ以前からの挙動である。
  //    述語全体に掛けると、直近に試行があって（分岐3・分岐4経由でもあり得る）かつ
  //    モックアップが本当に60日古い行の鮮度保証まで週1へ落ちてしまう。ここで直すのは、
  //    このブランチが足した腕だけ。
  const staleCampaigns = activeWithMockups.filter(
    (row) =>
      (row.generatedAt !== null && row.generatedAt < sixtyDaysAgo) ||
      (needsRehost(row.urls, publicUrl) &&
        (!row.attemptedAt || row.attemptedAt < sevenDaysAgo))
  )

  const staleSeen = new Set<string>()
  for (const campaign of staleCampaigns) {
    if (!staleSeen.has(campaign.id)) {
      staleSeen.add(campaign.id)
      // ここに来る行は「60日超」か「needsRehost」のどちらかで、いずれも既に
      // mockupGeneratedAt が付いている。force なしでは generateCampaignMockups
      // 自身のガードに弾かれ、この分岐は何もしない。
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
    mockupObjectsDeleted,
    designMockupUrlsCleared,
    orphanedUploadsDeleted: orphanSweep.deleted,
    ordersAnonymized: piiSweep.anonymized,
    printfulReconcile,
  })
}
