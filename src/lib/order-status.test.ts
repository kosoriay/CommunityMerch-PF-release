import { describe, it, expect } from "vitest"
import {
  REVENUE_ORDER_STATUSES,
  countsAsRevenue,
  isRefundable,
} from "@/lib/order-status"

describe("countsAsRevenue", () => {
  it("should count every status from paid through delivered", () => {
    // Regression: filtering on "paid" alone dropped an order out of revenue the
    // moment fulfilment advanced it, so reported totals shrank over time.
    expect(countsAsRevenue("paid")).toBe(true)
    expect(countsAsRevenue("fulfilled")).toBe(true)
    expect(countsAsRevenue("shipped")).toBe(true)
    expect(countsAsRevenue("delivered")).toBe(true)
  })

  it("should not count a pending checkout", () => {
    expect(countsAsRevenue("pending")).toBe(false)
  })

  it("should not count a refunded order", () => {
    expect(countsAsRevenue("refunded")).toBe(false)
  })
})

describe("isRefundable", () => {
  it("should allow a refund from any status where the buyer has been charged", () => {
    for (const status of REVENUE_ORDER_STATUSES) {
      expect(isRefundable(status)).toBe(true)
    }
  })

  it("should refuse a pending order, where no money has been taken", () => {
    expect(isRefundable("pending")).toBe(false)
  })

  it("should refuse an already-refunded order", () => {
    expect(isRefundable("refunded")).toBe(false)
  })
})
