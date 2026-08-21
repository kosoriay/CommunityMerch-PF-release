import { describe, it, expect } from "vitest"
import { selectVariantIdsForColors } from "./printful"

const BC3001 = [
  { id: 4011, size: "S", color: "White" }, { id: 4012, size: "M", color: "White" },
  { id: 4016, size: "S", color: "Black" }, { id: 4017, size: "M", color: "Black" },
  { id: 4112, size: "M", color: "Navy" },
]

describe("selectVariantIdsForColors", () => {
  it("picks the requested size for each requested colour", () => {
    const r = selectVariantIdsForColors(BC3001, ["White", "Black"], "M")
    expect(r.get("White")).toBe(4012)
    expect(r.get("Black")).toBe(4017)
  })

  it("skips a colour Printful does not have, without dropping the others", () => {
    const r = selectVariantIdsForColors(BC3001, ["White", "Chartreuse"], "M")
    expect(r.get("White")).toBe(4012)
    expect(r.size).toBe(1)
  })

  it("skips a colour that exists but not in the requested size", () => {
    expect(selectVariantIdsForColors(BC3001, ["Navy"], "S").size).toBe(0)
  })

  it("returns nothing for an empty colour list", () => {
    expect(selectVariantIdsForColors(BC3001, [], "M").size).toBe(0)
  })

  it("matches colour and size exactly", () => {
    expect(selectVariantIdsForColors(BC3001, ["white"], "M").size).toBe(0)
    expect(selectVariantIdsForColors(BC3001, ["White"], "m").size).toBe(0)
  })

  it("handles a one-size product and a colour containing a slash", () => {
    const trucker = [{ id: 8748, size: "One size", color: "Black/ White" }]
    expect(selectVariantIdsForColors(trucker, ["Black/ White"], "One size").get("Black/ White")).toBe(8748)
  })
})
