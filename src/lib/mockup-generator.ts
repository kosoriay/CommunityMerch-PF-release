import "server-only"
import { db } from "@/lib/db/client"
import { campaignProducts, designs, printfulCatalog } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { generateMockups } from "@/lib/providers/printful-mockup"
import { getPrintfulVariantIdsByColor } from "@/lib/providers/printful"
import { parseCatalogRow } from "@/lib/catalog-db"
import { colorsFor, representativeSizeFor } from "@/lib/cart-options"

/**
 * printful-mockup.ts は placement "front" と 1800x2400 のプリント領域を固定して
 * おり、これはアパレル前面の寸法である。マグ・帽子・トートに同じ寸法で投げると、
 * 失敗するか、失敗より厄介な「見た目が変なモックアップ」が返る。カタログ写真の
 * ほうが確実に正しい（設計 §8.4）。
 */
export const APPAREL_WITH_VERIFIED_PLACEMENT = new Set([
  "bc-3001-tee", "bc-3001y-tee", "bc-3501-ls", "bc-3413-triblend",
  "gildan-5000-classic", "gildan-64000-softstyle", "gildan-18000-crewneck",
  "gildan-18500-hoodie", "ch-m2580-hoodie", "cc-1717-garment-dyed",
])

/** 分類漏れをテストで落とすための対集合。placement 未対応の商品。 */
export const NON_APPAREL = new Set([
  "yupoong-6245cm-dad-hat", "yupoong-6606-trucker", "yupoong-6089m-snapback",
  "yupoong-1501kc-beanie", "white-glossy-mug", "atc-bg150-tote", "econscious-ec8000-tote",
])

/**
 * キャンペーンの商品ごとに、**団体が実際に売る色**のモックアップを作る。
 *
 * **作業が必要な行だけを触る。** 既にモックアップがある行には一切書かない
 * （設計 §8.6 の不変条件 (ii)）。そして**試みた行には成否によらず
 * mockup_attempted_at を打つ** — 意図的にスキップした非アパレルも「試みた」に
 * 含める。これが無いと cron 分岐4が同じキャンペーンを毎日選び、隣の商品の
 * 成功済みモックアップを毎日上書きする（設計 §8.6 の不変条件 (i)）。
 */
export async function generateCampaignMockups(
  campaignId: string,
  opts: { force?: boolean } = {}
): Promise<void> {
  const [design] = await db.select().from(designs).where(eq(designs.campaignId, campaignId))
  if (!design?.designFileUrl) return

  const products = await db.select().from(campaignProducts)
    .where(eq(campaignProducts.campaignId, campaignId))

  for (const product of products) {
    // 作業が要らない行は読まない・書かない。ただし routine な cron 実行が成功済みの
    // 行を勝手に上書きしてはいけない、という原則の例外が二つだけある: mockup-cleanup
    // route.ts の分岐2（60日超の陳腐化）と分岐3（デザイン更新後）で、この二つは
    // 「既に成功した行を更新し直す」ことそのものが目的なので、呼び出し側が
    // opts.force で明示的にこのガードだけを外す。分岐4（未生成）はこの対象外 ——
    // force すると Task 10 の収束の仕組みを壊す。
    if (product.mockupGeneratedAt && !opts.force) continue

    const attemptedAt = new Date()
    const stamp = async (extra: Record<string, unknown> = {}) => {
      await db.update(campaignProducts).set({ mockupAttemptedAt: attemptedAt, ...extra })
        .where(eq(campaignProducts.id, product.id))
    }

    try {
      if (!APPAREL_WITH_VERIFIED_PLACEMENT.has(product.printfulVariantId)) {
        // 意図的なスキップ。カタログ写真で代替する（設計 §8.4）。
        await stamp()
        continue
      }

      const [row] = await db.select().from(printfulCatalog)
        .where(eq(printfulCatalog.id, product.printfulVariantId))
      if (!row) { await stamp(); continue }
      const item = parseCatalogRow(row)

      const colors = colorsFor(item, JSON.parse(product.availableColors) as string[])
      if (colors.length === 0) {
        console.warn(`[mockups] ${product.printfulVariantId}: none of the chosen colours is sellable`)
        await stamp()
        continue
      }

      const size = representativeSizeFor(item, colors)
      if (!size) {
        console.warn(`[mockups] ${product.printfulVariantId}: no size works for ${colors.join(",")}`)
        await stamp()
        continue
      }

      const variantIdByColor = await getPrintfulVariantIdsByColor(item.printfulProductId, colors, size)
      if (variantIdByColor.size === 0) {
        console.warn(`[mockups] no Printful variants matched for ${product.printfulVariantId} size=${size}`)
        await stamp()
        continue
      }

      const urlByVariant = await generateMockups(
        design.designFileUrl, item.printfulProductId, [...variantIdByColor.values()]
      )

      // 返却順は要求順と一致しない。variant ID で突き合わせる（設計 §5.3）。
      const urlByColor: Record<string, string> = {}
      for (const [color, variantId] of variantIdByColor) {
        const url = urlByVariant.get(variantId)
        if (url) urlByColor[color] = url
      }
      if (Object.keys(urlByColor).length === 0) {
        console.warn(`[mockups] Printful returned no front mockups for ${product.printfulVariantId}`)
        await stamp()
        continue
      }

      await stamp({
        // 代表色の URL。mockup-cleanup/route.ts:48,52 と page.tsx:152 が読む。
        mockupUrl: urlByColor[colors[0]] ?? Object.values(urlByColor)[0],
        mockupUrls: JSON.stringify(urlByColor),
        mockupGeneratedAt: new Date(),
      })
    } catch (err) {
      // 部分失敗で公開は止めない。ただし黙らない（設計 §8.7）。
      console.warn(`[mockups] failed for ${product.printfulVariantId}:`, err)
      try { await stamp() } catch { /* 試行の記録に失敗しても本体は続ける */ }
    }
  }
}
