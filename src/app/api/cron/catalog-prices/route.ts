import { NextResponse } from "next/server"
import { db } from "@/lib/db/client"
import { printfulCatalog } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { getPrintfulVariantPriceCents } from "@/lib/providers/printful"
import { decidePodCostUpdate } from "@/lib/catalog-price-sync"

// Weekly sync of catalog production costs from the Printful API. Keeps the
// margin calculator and fee recovery honest without waiting for a release.
// Prices are read from each item's base variant (the same White/M variant the
// seed data was captured from). Campaign products snapshot their podCost at
// creation, so running campaigns are never affected — only new campaigns and
// the pricing calculator pick up synced prices.
export async function GET(req: Request): Promise<NextResponse> {
  const authHeader = req.headers.get("Authorization")
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const rows = await db
    .select()
    .from(printfulCatalog)
    .where(eq(printfulCatalog.isEnabled, true))

  let updated = 0
  let unchanged = 0
  let skipped = 0
  const details: string[] = []

  for (const row of rows) {
    if (!row.defaultMockupVariantId) {
      skipped++
      details.push(`${row.id}: no base variant id`)
      continue
    }

    let fetched: number | null = null
    try {
      fetched = await getPrintfulVariantPriceCents(row.printfulProductId, row.defaultMockupVariantId)
    } catch {
      fetched = null
    }

    const decision = decidePodCostUpdate(row.podCostCents, fetched)
    if (decision.action === "update") {
      await db
        .update(printfulCatalog)
        .set({ podCostCents: decision.newPodCostCents, updatedAt: new Date() })
        .where(eq(printfulCatalog.id, row.id))
      updated++
      details.push(`${row.id}: ${row.podCostCents} -> ${decision.newPodCostCents}`)
      console.log(`[catalog-prices] updated ${row.id}: ${row.podCostCents} -> ${decision.newPodCostCents}`)
    } else if (decision.action === "unchanged") {
      unchanged++
    } else {
      skipped++
      details.push(`${row.id}: ${decision.reason}`)
      console.warn(`[catalog-prices] skipped ${row.id}: ${decision.reason}`)
    }
  }

  console.log(`[catalog-prices] done: ${updated} updated, ${unchanged} unchanged, ${skipped} skipped`)
  return NextResponse.json({ updated, unchanged, skipped, details })
}
