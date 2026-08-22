import { vi } from "vitest"
import { describe, it, expect, beforeEach } from "vitest"
import { getTableName, type Table } from "drizzle-orm"
import { campaignProducts as campaignProductsTable } from "@/lib/db/schema"

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

vi.mock("@/lib/db/client", () => ({
  db: {
    transaction: async (fn: (tx: unknown) => Promise<void>) => {
      const tx = {
        select: () => ({ from: () => ({ where: async () => existingRows }) }),
        delete: () => ({ where: async (w: unknown) => { txLog.deleted.push(w) } }),
        insert: () => ({ values: async (v: Record<string, unknown>) => { txLog.inserted.push(v) } }),
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
      await fn(tx)
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
}))

import { generateCampaignSlug, supersededDesignKey, savePricingStep } from "./campaigns"

beforeEach(() => {
  txLog.deleted = []
  txLog.inserted = []
  txLog.updated = []
  txLog.campaignUpdated = []
  setExistingCampaignProducts([])
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
