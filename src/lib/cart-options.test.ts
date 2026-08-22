import { describe, it, expect } from "vitest"
import type { CatalogItem } from "./catalog-utils"
import {
  sizesFor, colorsFor, defaultColorFor, isSellablePair, representativeSizeFor,
  initialSelectedSizes, cartItemCount, formatOrderHeading, addedToCartMessage,
} from "./cart-options"

/** 一次資料（2026-08-19）から起こした最小のカタログ行。 */
function item(over: Partial<CatalogItem> & Pick<CatalogItem, "id">): CatalogItem {
  return {
    printfulProductId: 0, name: over.id, description: "",
    catalogImageUrl: "https://example.com/catalog.jpg", podCostCents: 1000,
    availableColors: [{ name: "White", hex: "#ffffff" }],
    sizes: ["S", "M", "L"], unavailablePairs: [], isEnabled: true, ...over,
  }
}

const TEE = item({
  id: "bc-3001-tee",
  sizes: ["XS", "S", "M", "L", "XL", "2XL"],
  unavailablePairs: [{ size: "XS", color: "Forest" }],
  availableColors: [
    { name: "White", hex: "#ffffff" }, { name: "Black", hex: "#0c0c0c" },
    { name: "Red", hex: "#d0071e" }, { name: "Forest", hex: "#223e25" },
  ],
})
const KIDS = item({ id: "bc-3001y-tee", sizes: ["S", "M", "L", "XL"] })
const MUG = item({ id: "white-glossy-mug", sizes: ["11 oz"] })
const HAT = item({
  id: "yupoong-6089m-snapback", sizes: ["One size"],
  availableColors: [{ name: "Black", hex: "#000" }, { name: "Dark Grey", hex: "#333" }],
})
// (A) Printful に White が無い — 発送不能だった側
const TRIBLEND = item({
  id: "bc-3413-triblend", sizes: ["XS", "S", "M", "L", "XL", "2XL"],
  availableColors: [{ name: "Solid White Triblend", hex: "#ffffff" }],
})
// (B) Printful には White があるが販売可能色に無い — 白い商品が黙って出ていた側
const BEANIE = item({
  id: "yupoong-1501kc-beanie", sizes: ["One size"],
  availableColors: [{ name: "Black", hex: "#000" }, { name: "Navy", hex: "#123" }],
})
// 色名に "/" が入る。連結キーを禁じた理由（設計 §7.2）
const TRUCKER = item({
  id: "yupoong-6606-trucker", sizes: ["One size"],
  availableColors: [
    { name: "Black", hex: "#181818" }, { name: "Black/ White", hex: "#181818" },
    { name: "Navy/ White", hex: "#24303b" },
  ],
  unavailablePairs: [{ size: "One size", color: "Navy/ White" }],
})
const UNSELLABLE = item({ id: "broken", sizes: [] })

describe("sizesFor", () => {
  it("returns the product's own sizes", () => {
    expect(sizesFor(KIDS)).toEqual(["S", "M", "L", "XL"])
    expect(sizesFor(MUG)).toEqual(["11 oz"])
  })

  it("returns nothing for an unknown product — no fallback to the old hardcoded sizes", () => {
    expect(sizesFor(undefined)).toEqual([])
  })
})

describe("colorsFor", () => {
  it("intersects the organisation's choice with what the product can be made in", () => {
    expect(colorsFor(TEE, ["Black", "Forest"])).toEqual(["Black", "Forest"])
  })

  it("drops a colour the organisation chose that the product does not have", () => {
    expect(colorsFor(TEE, ["Black", "Chartreuse"])).toEqual(["Black"])
  })

  it("keeps the organisation's order, because the first entry becomes the default", () => {
    expect(colorsFor(TEE, ["Forest", "White"])).toEqual(["Forest", "White"])
  })

  it("returns nothing when every chosen colour is unavailable", () => {
    // 本番には既定 ["White"] のまま保存された行があり、7商品ではそれが
    // 販売可能色に無い。その商品カードは購入不可になる（設計 §7.6）。
    expect(colorsFor(TRIBLEND, ["White"])).toEqual([])
    expect(colorsFor(BEANIE, ["White"])).toEqual([])
  })

  it("returns nothing for an unknown product", () => {
    expect(colorsFor(undefined, ["White"])).toEqual([])
  })
})

describe("defaultColorFor", () => {
  it("is the first colour the product can be made in", () => {
    expect(defaultColorFor(TEE)).toBe("White")
  })

  it("is not White where Printful has no White", () => {
    expect(defaultColorFor(TRIBLEND)).toBe("Solid White Triblend")
  })

  it("is not White where the product would have shipped in a colour nobody chose", () => {
    expect(defaultColorFor(BEANIE)).toBe("Black")
  })

  it("returns null when there is no colour at all", () => {
    expect(defaultColorFor(item({ id: "x", availableColors: [] }))).toBeNull()
    expect(defaultColorFor(undefined)).toBeNull()
  })
})

describe("isSellablePair", () => {
  it("accepts a pair that exists", () => {
    expect(isSellablePair(TEE, "M", "Black")).toBe(true)
    expect(isSellablePair(MUG, "11 oz", "White")).toBe(true)
    expect(isSellablePair(HAT, "One size", "Dark Grey")).toBe(true)
  })

  it("refuses XS and 2XL on the kids tee", () => {
    // 本番のアクティブ3キャンペーン全てで今日買えていた組合せ（設計 §0）
    expect(isSellablePair(KIDS, "XS", "White")).toBe(false)
    expect(isSellablePair(KIDS, "2XL", "White")).toBe(false)
    expect(isSellablePair(KIDS, "M", "White")).toBe(true)
  })

  it("refuses apparel sizes on a mug and a hat", () => {
    expect(isSellablePair(MUG, "M", "White")).toBe(false)
    expect(isSellablePair(HAT, "L", "Black")).toBe(false)
  })

  it("refuses a size the catalog does not sell even though Printful has it", () => {
    expect(isSellablePair(TEE, "3XL", "White")).toBe(false)
    expect(isSellablePair(MUG, "20 oz", "White")).toBe(false)
  })

  it("refuses White where Printful has no White — the order would throw after payment", () => {
    expect(isSellablePair(TRIBLEND, "M", "White")).toBe(false)
    expect(isSellablePair(TRIBLEND, "M", "Solid White Triblend")).toBe(true)
  })

  it("refuses White where Printful has it but the product does not sell it — a colour nobody chose would ship", () => {
    expect(isSellablePair(BEANIE, "One size", "White")).toBe(false)
    expect(isSellablePair(BEANIE, "One size", "Black")).toBe(true)
  })

  it("refuses the pair whose size and colour both exist on their own", () => {
    expect(isSellablePair(TEE, "XS", "White")).toBe(true)
    expect(isSellablePair(TEE, "M", "Forest")).toBe(true)
    expect(isSellablePair(TEE, "XS", "Forest")).toBe(false)
  })

  it("matches excluded pairs on both fields, so a colour containing a slash still works", () => {
    // 連結キーなら "One size/Black/ White" と "One size/Navy/ White" の
    // 区切りが読めない（設計 §7.2）
    expect(isSellablePair(TRUCKER, "One size", "Black/ White")).toBe(true)
    expect(isSellablePair(TRUCKER, "One size", "Navy/ White")).toBe(false)
  })

  it("refuses everything when the product has no sizes", () => {
    expect(isSellablePair(UNSELLABLE, "M", "White")).toBe(false)
  })

  it("refuses everything for an unknown or disabled product", () => {
    expect(isSellablePair(undefined, "M", "White")).toBe(false)
    expect(isSellablePair({ ...TEE, isEnabled: false }, "M", "White")).toBe(false)
  })

  it("is exact — no trimming, no case folding", () => {
    expect(isSellablePair(TEE, "m", "Black")).toBe(false)
    expect(isSellablePair(TEE, " M", "Black")).toBe(false)
    expect(isSellablePair(TEE, "M", "black")).toBe(false)
  })

  it("refuses an empty or missing colour rather than supplying a default", () => {
    // 補完はこの関数の責務ではない。補ってよいのは UI の初期値だけである
    // （設計 §7.3）。ここで補うと orders.ts:39 と同じ穴が復活する。
    expect(isSellablePair(TEE, "M", "")).toBe(false)
    expect(isSellablePair(TEE, "", "Black")).toBe(false)
  })

  it("says yes to a colour the organisation never selected — this is why checkout needs step 4", () => {
    // **この関数はカタログしか見ない。** 黒しか売らない団体の Red を
    // 止めるのは colorsFor 側であって、ここではない（設計 §7.3 / §7.5 手順4）。
    // route.ts の同名テストと対で読むこと。
    expect(isSellablePair(TEE, "M", "Red")).toBe(true)
    expect(colorsFor(TEE, ["Black"])).not.toContain("Red")
  })
})

describe("representativeSizeFor", () => {
  it("prefers M when the product has it", () => {
    expect(representativeSizeFor(TEE, ["Black"])).toBe("M")
  })

  it("uses the only size for a one-size product", () => {
    expect(representativeSizeFor(MUG, ["White"])).toBe("11 oz")
    expect(representativeSizeFor(HAT, ["Black"])).toBe("One size")
  })

  it("skips a size that is excluded for the colours being generated", () => {
    // XS/Forest は存在しない。Forest だけを生成する場合、XS を代表に選ぶと
    // variant が解決できず、その色のモックアップが落ちる（設計 §8.2 手順3）。
    const xsOnly = { ...TEE, sizes: ["XS", "M"] }
    expect(representativeSizeFor(xsOnly, ["Forest"])).toBe("M")
  })

  it("returns null when no size works for any of the colours", () => {
    const xsOnly = { ...TEE, sizes: ["XS"] }
    expect(representativeSizeFor(xsOnly, ["Forest"])).toBeNull()
    expect(representativeSizeFor(UNSELLABLE, ["White"])).toBeNull()
  })
})

describe("initialSelectedSizes", () => {
  const catalog: Record<string, CatalogItem> = {
    "white-glossy-mug": MUG, "yupoong-6089m-snapback": HAT, "bc-3001-tee": TEE,
  }

  it("pre-selects the only size, so a mug can actually be added", () => {
    // これが無いと _cart.tsx:199 の disabled が外れず、単一サイズ商品は
    // 永久に追加できない（設計 §7.4）
    expect(initialSelectedSizes(
      [{ id: "p1", printfulVariantId: "white-glossy-mug" },
       { id: "p2", printfulVariantId: "yupoong-6089m-snapback" }],
      catalog
    )).toEqual({ p1: "11 oz", p2: "One size" })
  })

  it("leaves multi-size products unselected, so the buyer still chooses", () => {
    expect(initialSelectedSizes([{ id: "p3", printfulVariantId: "bc-3001-tee" }], catalog)).toEqual({})
  })

  it("leaves unknown products unselected", () => {
    expect(initialSelectedSizes([{ id: "p4", printfulVariantId: "nope" }], catalog)).toEqual({})
  })
})

describe("cartItemCount / formatOrderHeading", () => {
  it("counts pieces, not lines", () => {
    expect(cartItemCount([{ quantity: 2 }, { quantity: 1 }])).toBe(3)
    expect(cartItemCount([])).toBe(0)
  })

  it("uses the singular for one piece", () => {
    expect(formatOrderHeading(1)).toBe("Your order (1 item)")
    expect(formatOrderHeading(3)).toBe("Your order (3 items)")
  })
})

describe("addedToCartMessage", () => {
  it("is English, and names the product, colour, size and quantity", () => {
    // 公開ページの他の文字列はすべて英語（_cart.tsx:201,213,248,268）
    expect(addedToCartMessage({ name: "Unisex T-Shirt", color: "Black", size: "M", quantity: 1 }))
      .toBe("Added to cart: Unisex T-Shirt, Black, M, quantity 1.")
  })

  it("still names the size when there is only one — the buyer needs to know what arrives", () => {
    expect(addedToCartMessage({ name: "White Glossy Mug", color: "White", size: "11 oz", quantity: 2 }))
      .toBe("Added to cart: White Glossy Mug, White, 11 oz, quantity 2.")
  })
})
