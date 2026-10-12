import { vi } from "vitest"
import { describe, it, expect, beforeEach } from "vitest"
import { getTableName, type Table } from "drizzle-orm"
import {
  campaignProducts as campaignProductsTable,
  orderItems as orderItemsTable,
} from "@/lib/db/schema"

/**
 * savePricingStep が tx に何をしたかを記録する。
 *
 * `updated` は campaign_products への update のみ。savePricingStep は末尾で
 * campaigns 行（goalAmount/deadline/amountDisplayMode/updatedAt）も1回 update
 * するが、それは別物であり campaign_products への update 件数と混ざってはい
 * けない — 最初の実装ではテーブルを見ずに全 update を同じ配列へ積んでいたため、
 * 「商品を1件も更新していない」現行実装（DELETE + re-INSERT のみ）でも
 * campaigns の update 1件が紛れ込み、`toHaveLength(1)` が本来の理由と違う形で
 * 通ってしまっていた。campaigns 側の update は `campaignUpdated` に分離する。
 */
export const txLog: {
  deleted: unknown[]
  inserted: Record<string, unknown>[]
  updated: { set: Record<string, unknown> }[]
  campaignUpdated: { set: Record<string, unknown> }[]
} = { deleted: [], inserted: [], updated: [], campaignUpdated: [] }

let existingRows: Record<string, unknown>[] = []
export function setExistingCampaignProducts(rows: Record<string, unknown>[]) { existingRows = rows }

// campaign_product ids that have an order_items row. Routed by table so the
// order lookup never returns the campaign_products rows (or vice versa).
let orderedProductIds: string[] = []
export function setOrderedProductIds(ids: string[]) { orderedProductIds = ids; orderedAfterFailure = null }
// What the re-query after a failed delete sees (an order that arrived between check and delete).
let orderedAfterFailure: string[] | null = null
export function setOrderedAfterDeleteFailure(ids: string[]) { orderedAfterFailure = ids }
let deleteFailed = false
let insertError: Error | null = null
export function setInsertError(e: Error | null) { insertError = e }
// Set to make tx.delete throw, e.g. the FK backstop (check and delete are two statements).
let deleteError: Error | null = null
export function setDeleteError(e: Error | null) { deleteError = e }
// Set to make the order_items lookup itself throw.
let orderLookupError: Error | null = null
export function setOrderLookupError(e: Error | null) { orderLookupError = e }

vi.mock("@/lib/db/client", () => ({
  db: {
    transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        select: () => ({
          from: (table: Table) => ({
            where: async () => {
              if (getTableName(table) !== getTableName(orderItemsTable)) return existingRows
              if (orderLookupError) throw orderLookupError
              return (deleteFailed && orderedAfterFailure ? orderedAfterFailure : orderedProductIds).map((id) => ({ id }))
            },
          }),
        }),
        delete: () => ({
          where: async (w: unknown) => {
            if (deleteError) { deleteFailed = true; throw deleteError }
            txLog.deleted.push(w)
          },
        }),
        insert: () => ({ values: async (v: Record<string, unknown>) => { if (insertError) throw insertError; txLog.inserted.push(v) } }),
        update: (table: Table) => ({
          set: (s: Record<string, unknown>) => ({
            where: async () => {
              const log = getTableName(table) === getTableName(campaignProductsTable)
                ? txLog.updated
                : txLog.campaignUpdated
              log.push({ set: s })
            },
          }),
        }),
      }
      return fn(tx)
    },
  },
}))

// Stands in for the real bucket: anything under this prefix is ours, and the
// key is whatever follows it.
vi.mock("@/lib/providers/r2", () => ({
  r2KeyFromUrl: (url: string | null | undefined) => {
    const base = "https://cdn.example.com"
    if (!url || !url.startsWith(`${base}/`)) return null
    const key = url.slice(base.length + 1)
    return key.length > 0 ? key : null
  },
  deleteFromR2: async () => ({ deleted: 0, failed: 0 }),
  r2PublicUrlOrNull: () => "https://cdn.example.com",
}))

import {
  generateCampaignSlug, supersededDesignKey, savePricingStep, findDeletionBlockers,
  formatRemovalBlockedMessage,
} from "./campaigns"

beforeEach(() => {
  txLog.deleted = []
  txLog.inserted = []
  txLog.updated = []
  txLog.campaignUpdated = []
  setExistingCampaignProducts([])
  setOrderedProductIds([])
  setDeleteError(null)
  setInsertError(null)
  orderedAfterFailure = null
  deleteFailed = false
  setOrderLookupError(null)
})

describe("generateCampaignSlug", () => {
  it("combines title slug with year", () => {
    const result = generateCampaignSlug("Lincoln Elementary PTA", 2026)
    expect(result).toBe("lincoln-elementary-pta-2026")
  })

  it("strips special characters", () => {
    const result = generateCampaignSlug("St. Mary's Spring!", 2026)
    expect(result).toBe("st-marys-spring-2026")
  })

  it("truncates long titles", () => {
    const result = generateCampaignSlug("A".repeat(60), 2026)
    expect(result.length).toBeLessThanOrEqual(50)
  })

  it("never produces a reserved slug", () => {
    const result = generateCampaignSlug("Dashboard", 2026)
    expect(result).not.toBe("dashboard-2026")
  })
})

const OLD = "https://cdn.example.com/uploads/old.png"
const NEW = "https://cdn.example.com/uploads/new.png"

describe("supersededDesignKey", () => {
  it("should return the old key when the design is replaced", () => {
    expect(supersededDesignKey(OLD, NEW)).toBe("uploads/old.png")
  })

  it("should return the old key when the design is removed", () => {
    expect(supersededDesignKey(OLD, null)).toBe("uploads/old.png")
  })

  it("should return null when the design is unchanged", () => {
    // The design form resubmits the same hidden URL on every save. Deleting
    // here would destroy the design the campaign is currently showing.
    expect(supersededDesignKey(OLD, OLD)).toBeNull()
  })

  it("should return null when there was no previous design", () => {
    expect(supersededDesignKey(null, NEW)).toBeNull()
  })

  it("should return null when the previous design is not in our bucket", () => {
    // Dev writes to public/uploads/ instead of R2. A delete built from that
    // path would be aimed at a key we do not own.
    expect(supersededDesignKey("/uploads/local.png", NEW)).toBeNull()
  })

  it("should return null when both are absent", () => {
    expect(supersededDesignKey(null, null)).toBeNull()
  })
})

const TEE_ROW = {
  id: "cp-tee", campaignId: "c1", printfulVariantId: "bc-3001-tee",
  retailPrice: 2800, podCost: 1225, displayOrder: 0,
  availableColors: JSON.stringify(["Black", "Navy"]),
  mockupUrl: "https://cdn/black.jpg",
  mockupUrls: JSON.stringify({ Black: "https://cdn/black.jpg", Navy: "https://cdn/navy.jpg" }),
  mockupGeneratedAt: new Date("2026-08-01T00:00:00Z"),
  mockupAttemptedAt: new Date("2026-08-01T00:00:00Z"),
}
const input = (over: Partial<{ printfulVariantId: string; retailPrice: number; availableColors: string[] }> = {}) => ({
  printfulVariantId: "bc-3001-tee", retailPrice: 2900, podCost: 1225, displayOrder: 0,
  availableColors: ["Black", "Navy"], ...over,
})

describe("savePricingStep", () => {
  it("keeps the mockups when the same product is saved again", async () => {
    // 商品を1つも変えず価格を1円直しただけで、生成済みモックアップが全て
    // 消えていた（設計 §8.6 (A)）。生成は成功しているので警告も出ない。
    setExistingCampaignProducts([TEE_ROW])
    await savePricingStep("c1", [input({ retailPrice: 2900 })], null, null, "percent_only")

    expect(txLog.updated).toHaveLength(1)
    const set = txLog.updated[0].set
    expect(set.retailPrice).toBe(2900)
    expect(set).not.toHaveProperty("mockupUrl")
    expect(set).not.toHaveProperty("mockupGeneratedAt")
    expect(set.mockupUrls).toBe(TEE_ROW.mockupUrls)   // 色が変わっていないので素通し
  })

  it("does not delete a row that is still selected", async () => {
    // 参照され続けている行を消さないので、order_items の外部キーが緊張しない。
    // これが (B) を直す仕組みそのものである（設計 §8.6）。
    setExistingCampaignProducts([TEE_ROW])
    await savePricingStep("c1", [input()], null, null, "percent_only")

    expect(txLog.deleted).toHaveLength(0)
    expect(txLog.inserted).toHaveLength(0)
  })

  it("deletes only the products the organisation removed", async () => {
    const mugRow = { ...TEE_ROW, id: "cp-mug", printfulVariantId: "white-glossy-mug" }
    setExistingCampaignProducts([TEE_ROW, mugRow])
    await savePricingStep("c1", [input()], null, null, "percent_only")

    expect(txLog.deleted).toHaveLength(1)
    expect(txLog.inserted).toHaveLength(0)
  })

  it("inserts a newly selected product", async () => {
    setExistingCampaignProducts([])
    await savePricingStep("c1", [input()], null, null, "percent_only")

    expect(txLog.inserted).toHaveLength(1)
    expect(txLog.inserted[0].printfulVariantId).toBe("bc-3001-tee")
    expect(txLog.inserted[0].availableColors).toBe(JSON.stringify(["Black", "Navy"]))
  })

  it("drops mockup_urls keys for colours the organisation removed", async () => {
    setExistingCampaignProducts([TEE_ROW])
    await savePricingStep("c1", [input({ availableColors: ["Black"] })], null, null, "percent_only")

    expect(JSON.parse(txLog.updated[0].set.mockupUrls as string)).toEqual({ Black: "https://cdn/black.jpg" })
  })

  it("marks the product for regeneration when a colour is added", async () => {
    // cron 分岐4（Task 10）がこの NULL を拾う。分岐4が無ければ、この NULL 化は
    // 「二度と再生成されない行」を作るだけになる（設計 §8.6）。
    setExistingCampaignProducts([TEE_ROW])
    await savePricingStep("c1", [input({ availableColors: ["Black", "Navy", "Red"] })], null, null, "percent_only")

    expect(txLog.updated[0].set.mockupGeneratedAt).toBeNull()
  })
})

describe("formatRemovalBlockedMessage", () => {
  it("uses the singular verb for one product and the plural for several", () => {
    expect(formatRemovalBlockedMessage(["Mug"])).toBe(
      "Mug has orders and can't be removed. Keep it selected, or close the campaign."
    )
    expect(formatRemovalBlockedMessage(["Mug", "Tee"])).toMatch(/^Mug, Tee have orders/)
  })
})

describe("findDeletionBlockers", () => {
  it("returns only the ids to delete that have orders", () => {
    expect(findDeletionBlockers(["a", "b", "c"], ["b", "z"])).toEqual(["b"])
  })

  it("returns nothing when no id to delete has orders", () => {
    expect(findDeletionBlockers(["a"], ["z"])).toEqual([])
  })

  it("returns nothing when nothing is being deleted", () => {
    expect(findDeletionBlockers([], ["z"])).toEqual([])
  })
})

describe("savePricingStep when a removed product has orders", () => {
  const MUG_ROW = { ...TEE_ROW, id: "cp-mug", printfulVariantId: "white-glossy-mug" }

  it("refuses the save and writes nothing when a pending order references the removed product", async () => {
    // The exploit case: POST /api/checkout writes a pending order_items row before
    // Stripe, so any visitor can create this. A pending order must block the delete.
    setExistingCampaignProducts([TEE_ROW, MUG_ROW])
    setOrderedProductIds(["cp-mug"])

    const result = await savePricingStep("c1", [input({ retailPrice: 9900 })], 50000, new Date("2030-01-01"), "show_amount")

    expect(result).toEqual({ ok: false, blockedProductIds: ["cp-mug"] })
    expect(txLog.deleted).toHaveLength(0)
    expect(txLog.inserted).toHaveLength(0)
    expect(txLog.updated).toHaveLength(0)         // price edit not applied
    expect(txLog.campaignUpdated).toHaveLength(0) // goal/deadline not applied
  })

  it("lists every blocked product, not just the first", async () => {
    const hatRow = { ...TEE_ROW, id: "cp-hat", printfulVariantId: "hat" }
    setExistingCampaignProducts([TEE_ROW, MUG_ROW, hatRow])
    setOrderedProductIds(["cp-mug", "cp-hat"])

    const result = await savePricingStep("c1", [input()], null, null, "percent_only")

    expect(result).toEqual({ ok: false, blockedProductIds: ["cp-mug", "cp-hat"] })
  })

  it("saves normally when the product with orders stays selected", async () => {
    setExistingCampaignProducts([TEE_ROW])
    setOrderedProductIds(["cp-tee"])

    const result = await savePricingStep("c1", [input({ retailPrice: 3100 })], null, null, "percent_only")

    expect(result).toEqual({ ok: true })
    expect(txLog.deleted).toHaveLength(0)
    expect(txLog.updated[0].set.retailPrice).toBe(3100)
    expect(txLog.campaignUpdated).toHaveLength(1)
  })

  it("still deletes a removed product that has no orders", async () => {
    setExistingCampaignProducts([TEE_ROW, MUG_ROW])
    setOrderedProductIds(["cp-tee"]) // unrelated product has orders; the removed one has none

    const result = await savePricingStep("c1", [input()], null, null, "percent_only")

    expect(result).toEqual({ ok: true })
    expect(txLog.deleted).toHaveLength(1)
  })

  it("maps a foreign-key failure on delete to blocked, naming only products that really have orders (race backstop)", async () => {
    // Order created between the check and the delete: the first lookup saw none.
    const hatRow = { ...TEE_ROW, id: "cp-hat", printfulVariantId: "hat" }
    setExistingCampaignProducts([TEE_ROW, MUG_ROW, hatRow])
    setOrderedProductIds([])
    setOrderedAfterDeleteFailure(["cp-mug"])
    setDeleteError(new Error("SQLITE_CONSTRAINT: FOREIGN KEY constraint failed"))

    const result = await savePricingStep("c1", [input()], null, null, "percent_only")

    expect(result).toEqual({ ok: false, blockedProductIds: ["cp-mug"] })
    expect(txLog.campaignUpdated).toHaveLength(0)
  })

  it("returns blocked with no names when the re-query after a foreign-key failure finds none", async () => {
    setExistingCampaignProducts([TEE_ROW, MUG_ROW])
    setDeleteError(new Error("FOREIGN KEY constraint failed"))

    const result = await savePricingStep("c1", [input()], null, null, "percent_only")

    expect(result).toEqual({ ok: false, blockedProductIds: [] })
  })

  it("recognises a foreign-key failure nested in error.cause", async () => {
    setExistingCampaignProducts([TEE_ROW, MUG_ROW])
    setOrderedAfterDeleteFailure(["cp-mug"])
    setDeleteError(new Error("Failed query", { cause: new Error("SQLITE_CONSTRAINT: FOREIGN KEY constraint failed") }))

    const result = await savePricingStep("c1", [input()], null, null, "percent_only")

    expect(result).toEqual({ ok: false, blockedProductIds: ["cp-mug"] })
  })

  it("rethrows a foreign-key failure that comes from a statement other than the delete", async () => {
    setExistingCampaignProducts([])
    setInsertError(new Error("FOREIGN KEY constraint failed"))

    await expect(savePricingStep("c1", [input()], null, null, "percent_only")).rejects.toThrow("FOREIGN KEY")
  })

  it("rethrows a delete failure that is not a foreign-key failure", async () => {
    setExistingCampaignProducts([TEE_ROW, MUG_ROW])
    setDeleteError(new Error("disk I/O error"))

    await expect(savePricingStep("c1", [input()], null, null, "percent_only")).rejects.toThrow("disk I/O error")
  })

  it("lets a failing order lookup abort the save instead of reporting orders that may not exist", async () => {
    setExistingCampaignProducts([TEE_ROW, MUG_ROW])
    setOrderLookupError(new Error("db unavailable"))

    await expect(savePricingStep("c1", [input()], null, null, "percent_only")).rejects.toThrow("db unavailable")
    expect(txLog.deleted).toHaveLength(0)
  })
})
