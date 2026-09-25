import { describe, it, expect } from "vitest"
import { orderDisplayStage, ORDER_DISPLAY_STAGE_LABELS } from "./order-display-stage"

describe("orderDisplayStage (設計 §8 の表)", () => {
  it.each([
    ["pending", null, "processing"],
    ["paid", null, "preparing"],
    ["paid", "failed", "preparing"],
    ["fulfilled", "inprocess", "in_production"],
    ["fulfilled", "partial", "in_production"],
    ["fulfilled", "fulfilled", "in_production"],
    ["fulfilled", "archived", "in_production"],
    ["fulfilled", null, "preparing"],
    ["fulfilled", "pending", "preparing"],
    ["fulfilled", "inreview", "preparing"],
    ["fulfilled", "failed", "preparing"],
    ["fulfilled", "onhold", "preparing"],
    ["fulfilled", "some_future_status", "preparing"],
    ["shipped", null, "shipped"],
    ["delivered", null, "shipped"],
    ["refunded", "canceled", "refunded"],
  ] as const)("status %s + Printful %s → %s", (status, printfulStatus, expected) => {
    expect(orderDisplayStage(status, printfulStatus)).toBe(expected)
  })

  it("never claims an unknown order status has shipped", () => {
    expect(orderDisplayStage("some_future_status", "fulfilled")).toBe("preparing")
  })

  it("has a label for every stage", () => {
    for (const stage of ["processing", "preparing", "in_production", "shipped", "refunded"] as const) {
      expect(ORDER_DISPLAY_STAGE_LABELS[stage]).toBeTruthy()
    }
  })
})
