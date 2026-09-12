import type { UnavailablePair } from "@/lib/printful-catalog"

export type CatalogColor = {
  name: string
  hex: string
  imageUrl?: string
}

export type CatalogItem = {
  id: string
  printfulProductId: number
  name: string
  description: string
  catalogImageUrl: string
  podCostCents: number
  /** 販売可能色（カタログの色 ∩ Printful 実在色）。先頭が既定色。 */
  availableColors: CatalogColor[]
  /** 販売可能サイズ。空配列は「売らない」（設計 §7.6 フェイルクローズ）。 */
  sizes: string[]
  /** 対としては存在しない組合せ。連結文字列にしない（設計 §7.2）。 */
  unavailablePairs: UnavailablePair[]
  isEnabled: boolean
}

export function getColorImageFromItem(item: CatalogItem, colorName: string): string {
  const color = item.availableColors.find((c) => c.name === colorName)
  return color?.imageUrl ?? item.catalogImageUrl
}

/**
 * 画像の読み込みが失敗したときに、次に何を出すか。
 *
 * **候補列（モックアップ → カタログ写真）は描画前に一度しか評価されない。**
 * `??` が見るのは null/undefined だけで、URLが生きているかは見ない。だから死んだ
 * モックアップURLが、生きているカタログ写真に勝つ。ここがその取り戻し口である
 * （設計 2026-09-11 §9）。
 *
 * 差し替えは1回だけ。同じURLを入れ直すと `onError` が再入して無限ループになる。
 */
export function imageFallback(args: {
  currentSrc: string
  fallbackUrl: string
  alreadyFellBack: boolean
}): { src: string } | { hide: true } {
  const { currentSrc, fallbackUrl, alreadyFellBack } = args
  if (!fallbackUrl || alreadyFellBack || currentSrc === fallbackUrl) return { hide: true }
  return { src: fallbackUrl }
}
