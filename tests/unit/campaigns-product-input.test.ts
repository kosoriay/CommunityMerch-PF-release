import { describe, it, expect } from "vitest"
import type { ProductInput } from "@/lib/campaigns"

describe("ProductInput type", () => {
  it("accepts availableColors as string array", () => {
    const input: ProductInput = {
      printfulVariantId: "bc-3001-tee",
      retailPrice: 2800,
      podCost: 1225,
      displayOrder: 0,
      availableColors: ["White", "Black"],
    }
    expect(input.availableColors).toEqual(["White", "Black"])
  })

  it("works without availableColors (optional field)", () => {
    const input: ProductInput = {
      printfulVariantId: "bc-3001-tee",
      retailPrice: 2800,
      podCost: 1225,
      displayOrder: 0,
    }
    expect(input.availableColors).toBeUndefined()
  })
})
