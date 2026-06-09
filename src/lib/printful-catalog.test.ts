import { describe, it, expect } from "vitest"
import { calculateMargin, PRINTFUL_VARIANTS, itemsNeededForGoal, PRINTFUL_PRODUCT_IDS, type PrintfulVariantId } from "./printful-catalog"

describe("calculateMargin", () => {
  it("calculates margin for a $28 tee with $12.25 pod cost", () => {
    // retail: $28.00 = 2800 cents
    // pod+buffer: 1225 * 1.10 = 1347.5 → round = 1348 cents
    // platform fee: 2800 * 0.09 = 252 cents
    // stripe: 2800 * 0.034 + 30 = 95.2 + 30 = 125.2 → round = 125 cents
    // profit: 2800 - 1348 - 252 - 125 = 1075 cents = $10.75
    const result = calculateMargin(2800, 1225)
    expect(result.podWithBufferCents).toBe(1348)
    expect(result.platformFeeCents).toBe(252)
    expect(result.stripeFeesCents).toBe(125)
    expect(result.profitCents).toBe(1075)
  })

  it("returns negative profit when retail price is too low", () => {
    const result = calculateMargin(1000, 1225)
    expect(result.profitCents).toBeLessThan(0)
  })

  it("PRINTFUL_VARIANTS has expected base costs", () => {
    expect(PRINTFUL_VARIANTS["bc-3001-tee"].podCostCents).toBe(1225)
    expect(PRINTFUL_VARIANTS["gildan-18500-hoodie"].podCostCents).toBe(1800)
  })
})

describe("itemsNeededForGoal", () => {
  it("calculates items needed correctly", () => {
    expect(itemsNeededForGoal(50000, 1075)).toBe(47) // ceil(500 / 10.75)
  })

  it("returns Infinity when profit is zero or negative", () => {
    expect(itemsNeededForGoal(50000, 0)).toBe(Infinity)
    expect(itemsNeededForGoal(50000, -100)).toBe(Infinity)
  })
})

describe("PRINTFUL_PRODUCT_IDS", () => {
  it("has a product ID for each internal variant", () => {
    const internalIds = Object.keys(PRINTFUL_VARIANTS) as PrintfulVariantId[]
    for (const id of internalIds) {
      expect(PRINTFUL_PRODUCT_IDS[id]).toBeDefined()
      expect(typeof PRINTFUL_PRODUCT_IDS[id]).toBe("number")
    }
  })
})
