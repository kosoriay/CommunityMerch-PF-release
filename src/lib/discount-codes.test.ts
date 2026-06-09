import { describe, it, expect, vi } from "vitest"

// Mock the DB client so the module can load without real env vars
vi.mock("@/lib/db/client", () => ({ db: {} }))

import { getPlatformFeeRate } from "./discount-codes"

const noCode = null

describe("getPlatformFeeRate", () => {
  it("returns 0 for internal orgs", () => {
    expect(getPlatformFeeRate({ isInternal: true, discountCodeId: null }, noCode)).toBe(0)
  })

  it("returns 0.09 with no discount code", () => {
    expect(getPlatformFeeRate({ isInternal: false, discountCodeId: null }, noCode)).toBe(0.09)
  })

  it("returns 0.09 when code is inactive", () => {
    const code = { isActive: false, discountType: "fee_waiver" as const, discountValue: 100 }
    expect(getPlatformFeeRate({ isInternal: false, discountCodeId: "x" }, code as never)).toBe(0.09)
  })

  it("returns 0 for fee_waiver code", () => {
    const code = { isActive: true, discountType: "fee_waiver" as const, discountValue: 100 }
    expect(getPlatformFeeRate({ isInternal: false, discountCodeId: "x" }, code as never)).toBe(0)
  })

  it("applies fee_percentage discount correctly (20% off → 7.2%)", () => {
    const code = { isActive: true, discountType: "fee_percentage" as const, discountValue: 20 }
    const rate = getPlatformFeeRate({ isInternal: false, discountCodeId: "x" }, code as never)
    expect(rate).toBeCloseTo(0.072, 5)
  })

  it("applies 100% fee_percentage discount → 0%", () => {
    const code = { isActive: true, discountType: "fee_percentage" as const, discountValue: 100 }
    const rate = getPlatformFeeRate({ isInternal: false, discountCodeId: "x" }, code as never)
    expect(rate).toBeCloseTo(0, 5)
  })

  it("internal org overrides any code", () => {
    const code = { isActive: true, discountType: "fee_percentage" as const, discountValue: 50 }
    expect(getPlatformFeeRate({ isInternal: true, discountCodeId: "x" }, code as never)).toBe(0)
  })
})
