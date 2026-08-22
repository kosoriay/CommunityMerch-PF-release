import "server-only"
import { db } from "@/lib/db/client"
import { printfulCatalog } from "@/lib/db/schema"
import { eq, asc, inArray } from "drizzle-orm"
import type { CatalogColor, CatalogItem } from "@/lib/catalog-utils"
import type { UnavailablePair } from "@/lib/printful-catalog"

export type { CatalogColor, CatalogItem } from "@/lib/catalog-utils"

/** DB の1行を CatalogItem にする。mockup-generator も使う。 */
export function parseCatalogRow(row: typeof printfulCatalog.$inferSelect): CatalogItem {
  return {
    id: row.id,
    printfulProductId: row.printfulProductId,
    name: row.name,
    description: row.description,
    catalogImageUrl: row.catalogImageUrl,
    podCostCents: row.podCostCents,
    availableColors: JSON.parse(row.availableColors) as CatalogColor[],
    sizes: JSON.parse(row.sizes) as string[],
    unavailablePairs: JSON.parse(row.unavailablePairs) as UnavailablePair[],
    isEnabled: row.isEnabled,
  }
}

export async function getCatalog(): Promise<CatalogItem[]> {
  const rows = await db
    .select()
    .from(printfulCatalog)
    .where(eq(printfulCatalog.isEnabled, true))
    .orderBy(asc(printfulCatalog.displayOrder))
  return rows.map(parseCatalogRow)
}

export async function getCatalogItem(id: string): Promise<CatalogItem | undefined> {
  const rows = await db
    .select()
    .from(printfulCatalog)
    .where(eq(printfulCatalog.id, id))
    .limit(1)
  return rows[0] ? parseCatalogRow(rows[0]) : undefined
}

/**
 * 決済がカタログ行を引くための一括取得。カートの行数だけ往復させない。
 *
 * **`is_enabled` で絞らない。** 呼び出し側が「行が無い」と「無効」を区別できる
 * ようにしてある。決済は両方 400 にするが、それは決済側の判断である（設計 §7.6）。
 */
export async function getCatalogItemsByIds(ids: string[]): Promise<Map<string, CatalogItem>> {
  if (ids.length === 0) return new Map()
  const rows = await db.select().from(printfulCatalog).where(inArray(printfulCatalog.id, ids))
  return new Map(rows.map((r) => [r.id, parseCatalogRow(r)]))
}

export { getColorImageFromItem } from "@/lib/catalog-utils"
