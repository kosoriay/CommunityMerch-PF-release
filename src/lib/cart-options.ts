import type { CatalogItem } from "@/lib/catalog-utils"

// クライアント（_cart.tsx）とサーバ（/api/checkout）の両方から import される。
// `import "server-only"` を足さないこと。DB にも DOM にも触らない。
//
// 画面と決済で答えが食い違うと、画面が売れると言ったものを決済が断るか、
// 決済が通したものを Printful が作れないかになる。後者は買い手が課金された
// まま商品が永久に届かない状態を作る（設計 §0）。

export const ADDED_FEEDBACK_MS = 2000

export function sizesFor(item: CatalogItem | undefined): string[] {
  return item?.sizes ?? []
}

/**
 * 実際に選べる色 = 団体の選択 ∩ 販売可能色。団体の並び順を保つ（先頭が既定）。
 */
export function colorsFor(item: CatalogItem | undefined, chosenColors: string[]): string[] {
  if (!item) return []
  const sellable = new Set(item.availableColors.map((c) => c.name))
  return chosenColors.filter((name) => sellable.has(name))
}

/** 既定色。`"White"` リテラルの置き換え先（設計 §3.2）。 */
export function defaultColorFor(item: CatalogItem | undefined): string | null {
  return item?.availableColors[0]?.name ?? null
}

/**
 * Printful がこの (サイズ, 色) を作れるか。
 *
 * **必要条件であって十分条件ではない。** 「その団体が売ると言ったか」には
 * 答えない。決済は `colorsFor(item, 団体の色)` も必ず見る（設計 §7.5 手順4）。
 *
 * 完全一致。空文字・未定義は拒否し、既定値で補わない。補完してよいのは
 * UI の初期値だけである（設計 §7.3）。
 */
export function isSellablePair(
  item: CatalogItem | undefined,
  size: string,
  color: string
): boolean {
  if (!item || !item.isEnabled) return false
  if (!size || !color) return false
  if (!item.sizes.includes(size)) return false
  if (!item.availableColors.some((c) => c.name === color)) return false
  // 連結キーではなく2フィールドで突き合わせる。色名に "/" が入る商品がある。
  return !item.unavailablePairs.some((p) => p.size === size && p.color === color)
}

/**
 * モックアップを作る代表サイズ。`M` を優先し、指定色すべてで成立するものを選ぶ。
 * 見た目を決めるのは色でありサイズではないので1つでよい（設計 §8.2 手順3）。
 */
export function representativeSizeFor(
  item: CatalogItem | undefined,
  colors: string[]
): string | null {
  const sizes = sizesFor(item)
  if (sizes.length === 0 || colors.length === 0) return null
  const ordered = sizes.includes("M") ? ["M", ...sizes.filter((s) => s !== "M")] : sizes
  return ordered.find((size) => colors.some((c) => isSellablePair(item, size, c))) ?? null
}

/**
 * マウント時に張るサイズの初期選択。
 *
 * サイズが1つの商品はラベル表示だけで選ばせないが、**選択状態は別に存在しな
 * ければならない**。`_cart.tsx:199` が `selectedSizes[product.id]` で追加ボタンを
 * 無効化するため、これが無いとマグも帽子も永久に追加できない（設計 §7.4）。
 */
export function initialSelectedSizes(
  products: { id: string; printfulVariantId: string }[],
  catalog: Record<string, CatalogItem>
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const product of products) {
    const sizes = sizesFor(catalog[product.printfulVariantId])
    if (sizes.length === 1) out[product.id] = sizes[0]
  }
  return out
}

export function cartItemCount(items: { quantity: number }[]): number {
  return items.reduce((sum, i) => sum + i.quantity, 0)
}

export function formatOrderHeading(count: number): string {
  return `Your order (${count} ${count === 1 ? "item" : "items"})`
}

/** live region に流す文。英語（設計 §9）。 */
export function addedToCartMessage(args: {
  name: string; color: string; size: string; quantity: number
}): string {
  return `Added to cart: ${args.name}, ${args.color}, ${args.size}, quantity ${args.quantity}.`
}
