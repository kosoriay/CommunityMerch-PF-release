import { describe, it, expect, vi, beforeEach } from "vitest"

const inserted: { table: string; values: Record<string, unknown> }[] = []

vi.mock("@/lib/db/schema", () => ({
  orders: { _: { name: "orders" } },
  orderItems: { _: { name: "order_items" } },
}))
vi.mock("@/lib/db/client", () => ({
  db: {
    transaction: async (fn: (tx: unknown) => Promise<void>) => {
      const tx = {
        insert: (table: { _: { name: string } }) => ({
          values: async (values: Record<string, unknown>) => {
            inserted.push({ table: table._.name, values })
          },
        }),
      }
      await fn(tx)
    },
    query: { orders: { findFirst: async () => ({ id: "order-1" }) } },
  },
}))

import { createPendingOrder } from "./orders"

beforeEach(() => { inserted.length = 0 })

const items = () => inserted.filter((i) => i.table === "order_items").map((i) => i.values)

describe("createPendingOrder", () => {
  it("writes exactly the colour it was given", async () => {
    // orders.ts:39 は `color: item.color ?? "White"` だった。これは §7.5 の
    // 検証より**下流**にあり、検証を通った注文にあとから "White" を代入して
    // いた。bc-3413-triblend では決済後に printful.ts:90 が throw する。
    await createPendingOrder("c1", [
      { campaignProductId: "cp1", size: "M", quantity: 1, unitPriceCents: 2800, color: "Forest" },
    ])
    expect(items()).toHaveLength(1)
    expect(items()[0].color).toBe("Forest")
  })

  it("writes an undefined colour when a cart line arrives with none, never substituting White", async () => {
    // 型を外した呼び出し。実行時に color が欠けた場合を模す。
    await createPendingOrder("c1", [
      { campaignProductId: "cp1", size: "M", quantity: 1, unitPriceCents: 2800 } as never,
    ])
    expect(items()[0].color).toBeUndefined()   // "White" が代入されていないこと
  })

  it("does not substitute White for a colour that merely looks unusual", async () => {
    await createPendingOrder("c1", [
      { campaignProductId: "cp1", size: "One size", quantity: 1, unitPriceCents: 1800, color: "Black/ White" },
    ])
    expect(items()[0].color).toBe("Black/ White")
  })

  it("writes the size it was given, unchanged", async () => {
    await createPendingOrder("c1", [
      { campaignProductId: "cp1", size: "11 oz", quantity: 2, unitPriceCents: 1800, color: "White" },
    ])
    expect(items()[0].size).toBe("11 oz")
    expect(items()[0].quantity).toBe(2)
  })

  it("writes one order_items row per cart line", async () => {
    await createPendingOrder("c1", [
      { campaignProductId: "cp1", size: "M", quantity: 1, unitPriceCents: 2800, color: "Black" },
      { campaignProductId: "cp2", size: "L", quantity: 2, unitPriceCents: 2800, color: "Navy" },
    ])
    expect(items().map((i) => i.color)).toEqual(["Black", "Navy"])
  })
})
