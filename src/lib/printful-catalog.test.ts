import { describe, it, expect } from "vitest"
import {
  calculateMargin,
  PRINTFUL_VARIANTS,
  itemsNeededForGoal,
  PRINTFUL_PRODUCT_IDS,
  SHIPPING_RATES,
  DEFAULT_SHIPPING_RATE,
  estimateShippingCents,
  calculateCheckoutApplicationFee,
  type PrintfulVariantId,
} from "./printful-catalog"

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

describe("SHIPPING_RATES", () => {
  it("has a shipping rate for each internal variant", () => {
    const internalIds = Object.keys(PRINTFUL_VARIANTS) as PrintfulVariantId[]
    for (const id of internalIds) {
      expect(SHIPPING_RATES[id]).toBeDefined()
    }
  })
})

describe("estimateShippingCents", () => {
  it("should charge the first-item rate when one unit is ordered", () => {
    expect(estimateShippingCents([{ printfulVariantId: "bc-3001-tee", quantity: 1 }])).toBe(469)
  })

  it("should add the additional-item rate for extra units of the same item", () => {
    // 469 (first) + 220 (second unit)
    expect(estimateShippingCents([{ printfulVariantId: "bc-3001-tee", quantity: 2 }])).toBe(689)
  })

  it("should apply the highest first-item rate once for mixed carts", () => {
    // hoodie first (749) + tee additional (220)
    const result = estimateShippingCents([
      { printfulVariantId: "bc-3001-tee", quantity: 1 },
      { printfulVariantId: "gildan-18500-hoodie", quantity: 1 },
    ])
    expect(result).toBe(749 + 220)
  })

  it("should fall back to the default rate for unknown items", () => {
    expect(estimateShippingCents([{ printfulVariantId: "unknown-item", quantity: 1 }])).toBe(
      DEFAULT_SHIPPING_RATE.firstCents
    )
  })

  it("should return zero for an empty cart", () => {
    expect(estimateShippingCents([])).toBe(0)
  })
})

describe("calculateCheckoutApplicationFee", () => {
  it("recovers POD, shipping, Stripe fees and the platform fee", () => {
    // pod+buffer: 1225 * 1.10 = 1347.5 → 1348
    // shipping: 469
    // platform fee: 2800 * 0.09 = 252
    // stripe: (2800 + 469) * 0.034 + 30 = 111.146 + 30 → 141
    // total: 1348 + 469 + 252 + 141 = 2210
    const fee = calculateCheckoutApplicationFee({
      itemSubtotalCents: 2800,
      podCostCents: 1225,
      shippingCents: 469,
      feeRate: 0.09,
    })
    expect(fee).toBe(2210)
    // Org receives (2800 + 469) - 2210 = 1059 — within a few cents of the
    // pricing tool's displayed profit (1075), the delta being Stripe's cut of
    // the shipping charge.
    expect(2800 + 469 - fee).toBe(1059)
  })

  it("still recovers costs when the platform fee rate is zero", () => {
    const fee = calculateCheckoutApplicationFee({
      itemSubtotalCents: 2800,
      podCostCents: 1225,
      shippingCents: 469,
      feeRate: 0,
    })
    expect(fee).toBe(1348 + 469 + 141)
  })

  it("defaults to the 9% platform fee rate", () => {
    const withDefault = calculateCheckoutApplicationFee({
      itemSubtotalCents: 2800,
      podCostCents: 1225,
      shippingCents: 469,
    })
    const withExplicit = calculateCheckoutApplicationFee({
      itemSubtotalCents: 2800,
      podCostCents: 1225,
      shippingCents: 469,
      feeRate: 0.09,
    })
    expect(withDefault).toBe(withExplicit)
  })
})
