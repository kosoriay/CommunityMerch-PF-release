import { describe, it, expect } from "vitest"
import { getColorImageFromItem, type CatalogItem } from "@/lib/catalog-utils"

const mockItem: CatalogItem = {
  id: "bc-3001-tee",
  printfulProductId: 71,
  name: "Unisex T-Shirt",
  description: "Bella+Canvas 3001",
  catalogImageUrl: "https://example.com/catalog.jpg",
  podCostCents: 1225,
  availableColors: [
    { name: "White", hex: "#ffffff", imageUrl: "https://example.com/white.jpg" },
    { name: "Black", hex: "#000000", imageUrl: "https://example.com/black.jpg" },
  ],
  isEnabled: true,
}

describe("getColorImageFromItem", () => {
  it("returns the color-specific imageUrl when the color exists", () => {
    expect(getColorImageFromItem(mockItem, "White")).toBe("https://example.com/white.jpg")
    expect(getColorImageFromItem(mockItem, "Black")).toBe("https://example.com/black.jpg")
  })

  it("falls back to catalogImageUrl for an unknown color name", () => {
    expect(getColorImageFromItem(mockItem, "Purple")).toBe("https://example.com/catalog.jpg")
  })

  it("falls back to catalogImageUrl when color has no imageUrl", () => {
    const noImg: CatalogItem = {
      ...mockItem,
      availableColors: [{ name: "White", hex: "#ffffff" }],
    }
    expect(getColorImageFromItem(noImg, "White")).toBe("https://example.com/catalog.jpg")
  })
})

describe("product image resolution", () => {
  it("prefers mockupUrl over catalogImageUrl when present", () => {
    const mockupUrl = "https://cdn.printful.com/mockup.jpg"
    const catalogUrl = "https://example.com/catalog.jpg"
    const displayUrl = mockupUrl ?? catalogUrl
    expect(displayUrl).toBe(mockupUrl)
  })

  it("falls back to catalogImageUrl when mockupUrl is null", () => {
    const mockupUrl: string | null = null
    const catalogUrl = "https://example.com/catalog.jpg"
    const displayUrl = mockupUrl ?? catalogUrl
    expect(displayUrl).toBe(catalogUrl)
  })
})
