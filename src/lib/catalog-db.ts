import "server-only"
import { db } from "@/lib/db/client"
import { printfulCatalog } from "@/lib/db/schema"
import { eq, asc } from "drizzle-orm"
import type { CatalogColor, CatalogItem } from "@/lib/catalog-utils"

export type { CatalogColor, CatalogItem } from "@/lib/catalog-utils"

function parseRow(row: typeof printfulCatalog.$inferSelect): CatalogItem {
  return {
    id: row.id,
    printfulProductId: row.printfulProductId,
    name: row.name,
    description: row.description,
    catalogImageUrl: row.catalogImageUrl,
    podCostCents: row.podCostCents,
    availableColors: JSON.parse(row.availableColors) as CatalogColor[],
    isEnabled: row.isEnabled,
  }
}

export async function getCatalog(): Promise<CatalogItem[]> {
  const rows = await db
    .select()
    .from(printfulCatalog)
    .where(eq(printfulCatalog.isEnabled, true))
    .orderBy(asc(printfulCatalog.displayOrder))
  return rows.map(parseRow)
}

export async function getCatalogItem(id: string): Promise<CatalogItem | undefined> {
  const rows = await db
    .select()
    .from(printfulCatalog)
    .where(eq(printfulCatalog.id, id))
    .limit(1)
  return rows[0] ? parseRow(rows[0]) : undefined
}

export { getColorImageFromItem } from "@/lib/catalog-utils"
