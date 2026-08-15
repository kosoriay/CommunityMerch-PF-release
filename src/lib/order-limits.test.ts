import { describe, it, expect } from "vitest"
import { resolveMaxOrderTotalCents, DEFAULT_MAX_ORDER_TOTAL_CENTS } from "@/lib/order-limits"

describe("resolveMaxOrderTotalCents", () => {
  it("should use the default when the variable is unset", () => {
    expect(resolveMaxOrderTotalCents(undefined)).toBe(DEFAULT_MAX_ORDER_TOTAL_CENTS)
  })

  it("should use the default when the variable is blank", () => {
    expect(resolveMaxOrderTotalCents("   ")).toBe(DEFAULT_MAX_ORDER_TOTAL_CENTS)
  })

  it("should use a valid configured value", () => {
    expect(resolveMaxOrderTotalCents("25000")).toBe(25000)
  })

  it("should fall back to the default rather than removing the cap when the value is unparseable", () => {
    // A typo must never silently disable the cap.
    expect(resolveMaxOrderTotalCents("abc")).toBe(DEFAULT_MAX_ORDER_TOTAL_CENTS)
    expect(resolveMaxOrderTotalCents("50_000")).toBe(DEFAULT_MAX_ORDER_TOTAL_CENTS)
  })

  it("should reject zero and negative values", () => {
    expect(resolveMaxOrderTotalCents("0")).toBe(DEFAULT_MAX_ORDER_TOTAL_CENTS)
    expect(resolveMaxOrderTotalCents("-100")).toBe(DEFAULT_MAX_ORDER_TOTAL_CENTS)
  })

  it("should reject a fractional value", () => {
    expect(resolveMaxOrderTotalCents("100.5")).toBe(DEFAULT_MAX_ORDER_TOTAL_CENTS)
  })

  it("should default to $500", () => {
    expect(DEFAULT_MAX_ORDER_TOTAL_CENTS).toBe(50_000)
  })
})
