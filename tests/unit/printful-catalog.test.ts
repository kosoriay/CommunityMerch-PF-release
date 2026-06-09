import { describe, it, expect } from "vitest"
import { PRINTFUL_VARIANTS, getColorImage, type PrintfulVariantId } from "@/lib/printful-catalog"

describe("PrintfulVariant color data", () => {
  it("each variant has availableColors with at least one color", () => {
    for (const v of Object.values(PRINTFUL_VARIANTS)) {
      expect(v.availableColors.length).toBeGreaterThan(0)
      expect(v.availableColors[0].name).toBeDefined()
      expect(v.availableColors[0].hex).toMatch(/^#[0-9a-fA-F]{6}$/)
    }
  })

  it("each variant has a catalogImageUrl string", () => {
    for (const v of Object.values(PRINTFUL_VARIANTS)) {
      expect(typeof v.catalogImageUrl).toBe("string")
      expect(v.catalogImageUrl.length).toBeGreaterThan(0)
    }
  })

  it("getColorImage returns catalogImageUrl when no color-specific imageUrl", () => {
    // Purple is not in any variant's color list
    const url = getColorImage("bc-3001-tee", "Purple")
    expect(url).toBe(PRINTFUL_VARIANTS["bc-3001-tee"].catalogImageUrl)
  })

  it("getColorImage returns color-specific imageUrl for each defined color", () => {
    // All colors now have their own imageUrl from the Printful API
    const blackUrl = getColorImage("bc-3001-tee", "Black")
    const blackColor = PRINTFUL_VARIANTS["bc-3001-tee"].availableColors.find(c => c.name === "Black")
    expect(blackUrl).toBe(blackColor?.imageUrl)
  })

  it("getColorImage returns color-specific imageUrl when available", () => {
    const url = getColorImage("bc-3001-tee", "White")
    const whiteColor = PRINTFUL_VARIANTS["bc-3001-tee"].availableColors.find(c => c.name === "White")
    expect(url).toBe(whiteColor?.imageUrl)
  })
})
