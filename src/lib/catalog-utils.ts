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
