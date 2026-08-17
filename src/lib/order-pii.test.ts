import { describe, it, expect } from "vitest"
import {
  selectAnonymizableOrders,
  canAnonymizeNow,
  DISPUTE_WINDOW_DAYS,
  type AnonymizableOrder,
} from "./order-pii"

const NOW = new Date("2026-08-16T12:00:00Z")
const DAY = 86_400_000
const MONTH = 30 * DAY

/** `monthsAgo` ヶ月前に最後に動いた注文。 */
function order(
  id: string,
  status: AnonymizableOrder["status"],
  monthsAgo: number,
  piiAnonymizedAt: Date | null = null
): AnonymizableOrder {
  return {
    id,
    status,
    updatedAt: new Date(NOW.getTime() - monthsAgo * MONTH),
    piiAnonymizedAt,
  }
}

const base = { now: NOW, retentionMonths: 24, limit: 500 }

describe("selectAnonymizableOrders", () => {
  it("should select a delivered order past the retention window", () => {
    expect(selectAnonymizableOrders({ ...base, orders: [order("a", "delivered", 25)] }))
      .toEqual(["a"])
  })

  it("should select a shipped order past the retention window", () => {
    expect(selectAnonymizableOrders({ ...base, orders: [order("a", "shipped", 25)] }))
      .toEqual(["a"])
  })

  it("should select a refunded order past the retention window", () => {
    // 返金済みは終端。金銭は精算されており、住所を持ち続ける理由がない
    expect(selectAnonymizableOrders({ ...base, orders: [order("a", "refunded", 25)] }))
      .toEqual(["a"])
  })

  it("should never select an order inside the retention window", () => {
    expect(selectAnonymizableOrders({ ...base, orders: [order("a", "delivered", 23)] }))
      .toEqual([])
  })

  it("should never select an order that is still in flight", () => {
    // paid と fulfilled はまだ発送されていない。住所が無ければ届けられない。
    // pending は決済が完了していない。いずれも古くても消してはいけない。
    const orders = [
      order("paid", "paid", 40),
      order("fulfilled", "fulfilled", 40),
      order("pending", "pending", 40),
    ]
    expect(selectAnonymizableOrders({ ...base, orders })).toEqual([])
  })

  it("should never select an order that is already anonymized", () => {
    // 冪等性。二度目の実行で同じ行を延々と選び直さない
    const orders = [order("a", "delivered", 40, new Date("2026-01-01T00:00:00Z"))]
    expect(selectAnonymizableOrders({ ...base, orders })).toEqual([])
  })

  it("should honour a shorter retention setting", () => {
    const orders = [order("a", "delivered", 13)]
    expect(selectAnonymizableOrders({ ...base, orders, retentionMonths: 12 })).toEqual(["a"])
    expect(selectAnonymizableOrders({ ...base, orders, retentionMonths: 24 })).toEqual([])
  })

  it("should stop at the limit", () => {
    const orders = Array.from({ length: 5 }, (_, i) => order(`o${i}`, "delivered", 30))
    expect(selectAnonymizableOrders({ ...base, orders, limit: 2 })).toHaveLength(2)
  })
})

describe("canAnonymizeNow", () => {
  it("should refuse an order inside the dispute window", () => {
    const o = order("a", "delivered", 1)
    const result = canAnonymizeNow(o, NOW, { force: false })
    expect(result.ok).toBe(false)
  })

  it("should allow an order past the dispute window", () => {
    const o = { ...order("a", "delivered", 0), updatedAt: new Date(NOW.getTime() - 100 * DAY) }
    expect(canAnonymizeNow(o, NOW, { force: false })).toEqual({ ok: true })
  })

  it("should allow an order inside the dispute window when forced", () => {
    // 返金は買い手の身元を必要とする。強制する場合は入力で確認させる
    const o = order("a", "delivered", 1)
    expect(canAnonymizeNow(o, NOW, { force: true })).toEqual({ ok: true })
  })

  it("should refuse an order that is already anonymized, even when forced", () => {
    const o = order("a", "delivered", 40, new Date("2026-01-01T00:00:00Z"))
    const result = canAnonymizeNow(o, NOW, { force: true })
    expect(result.ok).toBe(false)
  })

  it("should refuse an order that is still in flight, even when forced", () => {
    // 発送前に住所を消すと、その注文は二度と届けられない
    const o = order("a", "paid", 40)
    const result = canAnonymizeNow(o, NOW, { force: true })
    expect(result.ok).toBe(false)
  })

  it("should measure the dispute window in days from the last change", () => {
    const justInside = { ...order("a", "delivered", 0), updatedAt: new Date(NOW.getTime() - (DISPUTE_WINDOW_DAYS * DAY - 1)) }
    const justOutside = { ...order("a", "delivered", 0), updatedAt: new Date(NOW.getTime() - (DISPUTE_WINDOW_DAYS * DAY + 1)) }
    expect(canAnonymizeNow(justInside, NOW, { force: false }).ok).toBe(false)
    expect(canAnonymizeNow(justOutside, NOW, { force: false }).ok).toBe(true)
  })
})
