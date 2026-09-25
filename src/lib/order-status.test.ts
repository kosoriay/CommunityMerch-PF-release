import { describe, it, expect } from "vitest"
import {
  REVENUE_ORDER_STATUSES,
  countsAsRevenue,
  isRefundable,
  shouldWarnCancelInPrintfulFirst,
  recoveryMessageForOrder,
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

describe("shouldWarnCancelInPrintfulFirst (設計 §6.4)", () => {
  it.each([
    [{ status: "paid", printfulOrderId: "171", printfulStatus: null }, true],
    [{ status: "paid", printfulOrderId: null, printfulStatus: null }, false],
    [{ status: "fulfilled", printfulOrderId: "171", printfulStatus: "inprocess" }, true],
    [{ status: "fulfilled", printfulOrderId: "171", printfulStatus: "canceled" }, false],
    [{ status: "shipped", printfulOrderId: "171", printfulStatus: "fulfilled" }, false],
    [{ status: "refunded", printfulOrderId: "171", printfulStatus: null }, false],
  ])("%o → %s", (order, expected) => {
    expect(shouldWarnCancelInPrintfulFirst(order)).toBe(expected)
  })

  it("does not warn when Printful has no order for this reference (regression)", () => {
    // Printful reported not_found — telling the operator to "cancel it in Printful
    // first" makes no sense for an order Printful says does not exist.
    expect(
      shouldWarnCancelInPrintfulFirst({ status: "fulfilled", printfulOrderId: "171", printfulStatus: "not_found" })
    ).toBe(false)
  })

  it("warns for a needs-action status that is not not_found or canceled (control)", () => {
    // Same fixture shape as the regression case, differing only in printfulStatus —
    // proves the guard targets not_found specifically, not every needs-action status.
    expect(
      shouldWarnCancelInPrintfulFirst({ status: "fulfilled", printfulOrderId: "171", printfulStatus: "failed" })
    ).toBe(true)
  })
})

describe("recoveryMessageForOrder (設計 §6.3)", () => {
  it("returns the fulfillment error text for a paid order that failed to submit", () => {
    expect(
      recoveryMessageForOrder(
        { status: "paid", fulfillmentError: "Printful: invalid token" },
        null
      )
    ).toBe("Printful: invalid token")
  })

  it("returns the canned message for a paid order with no error that was never submitted (group B)", () => {
    expect(
      recoveryMessageForOrder({ status: "paid", fulfillmentError: null }, "unsubmitted")
    ).toBe("Payment was received but the order was never sent to Printful.")
  })

  it("returns null for a paid order with no error that has been submitted (not group B)", () => {
    expect(recoveryMessageForOrder({ status: "paid", fulfillmentError: null }, null)).toBeNull()
  })

  it("(control) returns the fulfillment error text for a paid order carrying the same error", () => {
    // Same fixture as the regression case below, differing only in status — proves the
    // guard is on status, not on the presence of fulfillment_error.
    expect(
      recoveryMessageForOrder({ status: "paid", fulfillmentError: "stale: 401 unauthorized" }, null)
    ).toBe("stale: 401 unauthorized")
  })

  it("returns null for a refunded order still carrying a stale fulfillment error (regression)", () => {
    // This is the bug the extraction exists to pin down: refunding used to leave
    // fulfillment_error in place, and the old inline check (`order.fulfillmentError &&`)
    // ignored status entirely, so RecoveryPanel kept offering Retry after the money
    // had already gone back.
    expect(
      recoveryMessageForOrder({ status: "refunded", fulfillmentError: "stale: 401 unauthorized" }, null)
    ).toBeNull()
  })

  it("returns null for a fulfilled order stuck on a Printful needs-action status", () => {
    // Not paid, so out of scope for Retry regardless of attention category — the
    // guidance panel (PrintfulStatusPanel) is what handles this case, not RecoveryPanel.
    expect(
      recoveryMessageForOrder({ status: "fulfilled", fulfillmentError: null }, "printful_stuck")
    ).toBeNull()
  })
})
