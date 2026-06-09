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
  availableColors: CatalogColor[]
  isEnabled: boolean
}

export function getColorImageFromItem(item: CatalogItem, colorName: string): string {
  const color = item.availableColors.find((c) => c.name === colorName)
  return color?.imageUrl ?? item.catalogImageUrl
}
