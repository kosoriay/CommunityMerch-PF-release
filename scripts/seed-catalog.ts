import { loadEnvConfig } from "@next/env"
loadEnvConfig(process.cwd())

import { createClient } from "@libsql/client"
import { drizzle } from "drizzle-orm/libsql"
import { printfulCatalog } from "../src/lib/db/schema"
import { PRINTFUL_VARIANTS, PRINTFUL_PRODUCT_IDS } from "../src/lib/printful-catalog"

// Confirmed via GET /products/{id} on 2026-06-06
// Each value is the Printful numeric variant ID for the White/M (or nearest) variant,
// used by the Mockup Generator API.
const MOCKUP_VARIANT_IDS: Record<string, number> = {
  "bc-3001-tee":          4012,   // White / M
  "bc-3001y-tee":         9427,   // White / M
  "bc-3501-ls":           10143,  // White / M
  "bc-3413-triblend":     16794,  // Solid White Triblend / M
  "gildan-5000-classic":  11577,  // White / M
  "gildan-64000-softstyle": 504,  // White / M
  "gildan-18000-crewneck": 5427,  // White / M
  "gildan-18500-hoodie":  5523,   // White / M
  "ch-m2580-hoodie":      10775,  // White / M
  "cc-1717-garment-dyed": 15125,  // White / M
  "yupoong-6245cm-dad-hat": 7853, // White / One size
  "yupoong-6606-trucker": 8748,   // Black/White / One size (no plain White)
  "yupoong-6089m-snapback": 22453, // White / One size
  "yupoong-1501kc-beanie": 8938,  // White / One size
  "white-glossy-mug":     1320,   // White / 11 oz
  "atc-bg150-tote":       16289,  // White / One size
  "econscious-ec8000-tote": 10458, // Oyster / One size (no White variant)
}

const url = process.env.TURSO_DATABASE_URL
if (!url) throw new Error("TURSO_DATABASE_URL is not set — check .env.local")

const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN })
const db = drizzle(client)

async function seed() {
  const now = new Date()
  const entries = Object.entries(PRINTFUL_VARIANTS)

  for (const [index, [id, variant]] of entries.entries()) {
    const printfulProductId = PRINTFUL_PRODUCT_IDS[id as keyof typeof PRINTFUL_PRODUCT_IDS]
    if (!printfulProductId) {
      console.warn(`SKIPPING ${id}: no Printful product ID found`)
      continue
    }

    await db
      .insert(printfulCatalog)
      .values({
        id: variant.id,
        printfulProductId,
        name: variant.name,
        description: variant.description,
        catalogImageUrl: variant.catalogImageUrl,
        podCostCents: variant.podCostCents,
        availableColors: JSON.stringify(variant.availableColors),
        sizes: JSON.stringify(variant.sizes),
        unavailablePairs: JSON.stringify(variant.unavailablePairs),
        displayOrder: index,
        isEnabled: true,
        defaultMockupVariantId: MOCKUP_VARIANT_IDS[id] ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: printfulCatalog.id,
        set: {
          printfulProductId,
          name: variant.name,
          description: variant.description,
          catalogImageUrl: variant.catalogImageUrl,
          // podCostCents deliberately NOT updated on conflict: the weekly
          // catalog-prices cron owns prices after the initial insert — a
          // redeploy must not revert synced prices to these static values.
          availableColors: JSON.stringify(variant.availableColors),
          // sizes / unavailablePairs は set にも入れる。17行は常に既存なので
          // conflict 側しか走らず、values にだけ書くと永久に '[]' のままになる。
          // podCostCents を set から外してあるのとは事情が逆である——原価は
          // 週次 cron が所有するが、サイズは静的ファイルが所有する（設計 §10.2）。
          sizes: JSON.stringify(variant.sizes),
          unavailablePairs: JSON.stringify(variant.unavailablePairs),
          displayOrder: index,
          defaultMockupVariantId: MOCKUP_VARIANT_IDS[id] ?? null,
          updatedAt: now,
        },
      })

    console.log(`  ✓ ${id}`)
  }

  console.log(`\nSeeded ${entries.length} catalog items into printful_catalog.`)

  // sizes が空の商品は売れない（設計 §7.6）ので、素通りさせると「何も買えない
  // ストアフロント」が本番に出る。db:init は vercel.json:2 の buildCommand の
  // 一部なので、非0で終わればデプロイが落ち旧コードが配信され続ける（設計 §10.3）。
  const check = await client.execute("SELECT id, sizes FROM printful_catalog ORDER BY display_order")
  const empty = check.rows.filter((r) => !r.sizes || r.sizes === "[]")
  if (empty.length > 0) {
    console.error(`\nFAILED: ${empty.length} catalog rows have empty sizes and cannot be sold:`)
    for (const row of empty) console.error(`  - ${row.id}`)
    await client.close()
    process.exit(1)
  }
  console.log(`Verified ${check.rows.length} rows have non-empty sizes.`)

  await client.close()
}

seed().catch((err) => {
  console.error(err)
  process.exit(1)
})
