// Seed source for printful_catalog DB table. See scripts/seed-catalog.ts.
// Runtime catalog access: use @/lib/catalog-db instead.
export type PrintfulVariantId =
  | "bc-3001-tee"
  | "bc-3001y-tee"
  | "bc-3501-ls"
  | "bc-3413-triblend"
  | "gildan-5000-classic"
  | "gildan-64000-softstyle"
  | "gildan-18000-crewneck"
  | "gildan-18500-hoodie"
  | "ch-m2580-hoodie"
  | "cc-1717-garment-dyed"
  | "yupoong-6245cm-dad-hat"
  | "yupoong-6606-trucker"
  | "yupoong-6089m-snapback"
  | "yupoong-1501kc-beanie"
  | "white-glossy-mug"
  | "atc-bg150-tote"
  | "econscious-ec8000-tote"

export type PrintfulColor = {
  name: string
  hex: string
  imageUrl?: string
}

export type PrintfulVariant = {
  id: PrintfulVariantId
  name: string
  podCostCents: number
  description: string
  catalogImageUrl: string
  availableColors: PrintfulColor[]
}

export const PRINTFUL_VARIANTS: Record<PrintfulVariantId, PrintfulVariant> = {
  "bc-3001-tee": {
    id: "bc-3001-tee",
    name: "Unisex T-Shirt",
    podCostCents: 1225,
    description: "Bella+Canvas 3001",
    catalogImageUrl: "https://files.cdn.printful.com/o/upload/product-catalog-img/20/2079a3ee4cc472ad952fe16654f274cd_l",
    availableColors: [
      { name: "White", hex: "#ffffff", imageUrl: "https://files.cdn.printful.com/products/71/4011_1752236284.jpg" },
      { name: "Black", hex: "#0c0c0c", imageUrl: "https://files.cdn.printful.com/products/71/4016_1752236278.jpg" },
      { name: "Navy", hex: "#212642", imageUrl: "https://files.cdn.printful.com/products/71/4111_1752236282.jpg" },
      { name: "Red", hex: "#d0071e", imageUrl: "https://files.cdn.printful.com/products/71/4141_1752236283.jpg" },
      { name: "Forest", hex: "#223e25", imageUrl: "https://files.cdn.printful.com/products/71/8451_1752236278.jpg" },
      { name: "Athletic Heather", hex: "#cececc", imageUrl: "https://files.cdn.printful.com/products/71/6948_1752236278.jpg" },
      { name: "Dark Grey", hex: "#2A2929", imageUrl: "https://files.cdn.printful.com/products/71/21577_1752236279.jpg" },
      { name: "Light Blue", hex: "#cfd5e1", imageUrl: "https://files.cdn.printful.com/products/71/4096_1752236281.jpg" },
    ],
  },
  "bc-3001y-tee": {
    id: "bc-3001y-tee",
    name: "Kids T-Shirt",
    podCostCents: 1050,
    description: "Bella+Canvas 3001Y",
    catalogImageUrl: "https://files.cdn.printful.com/o/upload/product-catalog-img/58/581883b4ad57201979eb275a568cb713_l",
    availableColors: [
      { name: "White", hex: "#ffffff", imageUrl: "https://files.cdn.printful.com/products/307/9428_1581518184.jpg" },
      { name: "Black", hex: "#131313", imageUrl: "https://files.cdn.printful.com/products/307/9432_1581517902.jpg" },
      { name: "Navy", hex: "#0d1529", imageUrl: "https://files.cdn.printful.com/products/307/9602_1581518073.jpg" },
      { name: "Red", hex: "#d0071e", imageUrl: "https://files.cdn.printful.com/products/307/10634_1581518147.jpg" },
    ],
  },
  "bc-3501-ls": {
    id: "bc-3501-ls",
    name: "Long Sleeve Tee",
    podCostCents: 1450,
    description: "Bella+Canvas 3501",
    catalogImageUrl: "https://files.cdn.printful.com/o/upload/product-catalog-img/81/81f6a07c7d89482446ca87dbd1489dd1_l",
    availableColors: [
      { name: "White", hex: "#ffffff", imageUrl: "https://files.cdn.printful.com/products/356/10141_1556619718.jpg" },
      { name: "Black", hex: "#131313", imageUrl: "https://files.cdn.printful.com/products/356/10098_1732542285.jpg" },
      { name: "Navy", hex: "#161324", imageUrl: "https://files.cdn.printful.com/products/356/10123_1556619717.jpg" },
      { name: "Dark Grey", hex: "#3e3c3d", imageUrl: "https://files.cdn.printful.com/products/356/11202_1603780158.jpg" },
    ],
  },
  "gildan-18500-hoodie": {
    id: "gildan-18500-hoodie",
    name: "Hoodie",
    podCostCents: 1800,
    description: "Gildan 18500",
    catalogImageUrl: "https://files.cdn.printful.com/o/upload/product-catalog-img/c6/c650a4604d04de3cedb2694e01920f60_l",
    availableColors: [
      { name: "White", hex: "#ffffff", imageUrl: "https://files.cdn.printful.com/products/146/5522_1750160842.jpg" },
      { name: "Black", hex: "#0b0b0b", imageUrl: "https://files.cdn.printful.com/products/146/5530_1750160839.jpg" },
      { name: "Navy", hex: "#131928", imageUrl: "https://files.cdn.printful.com/products/146/5594_1750160841.jpg" },
      { name: "Sport Grey", hex: "#9b969c", imageUrl: "https://files.cdn.printful.com/products/146/5610_1750160841.jpg" },
      { name: "Dark Heather", hex: "#47484d", imageUrl: "https://files.cdn.printful.com/products/146/10806_1750160842.jpg" },
    ],
  },
  "atc-bg150-tote": {
    id: "atc-bg150-tote",
    name: "Tote Bag",
    podCostCents: 850,
    description: "ATC BG150",
    catalogImageUrl: "https://files.cdn.printful.com/o/upload/product-catalog-img/fa/fa37e474f7c3d027440f63ab51ad7692_l",
    availableColors: [
      { name: "Natural", hex: "#fef3c7", imageUrl: "https://files.cdn.printful.com/products/641/16289_1666349190.jpg" },
      { name: "Black", hex: "#0a0a0a", imageUrl: "https://files.cdn.printful.com/products/641/16287_1666349183.jpg" },
      { name: "Navy", hex: "#1e3a5f", imageUrl: "https://files.cdn.printful.com/o/upload/product-catalog-img/fa/fa37e474f7c3d027440f63ab51ad7692_l" },
    ],
  },
  "bc-3413-triblend": {
    id: "bc-3413-triblend",
    name: "Unisex Tri-Blend Tee",
    podCostCents: 1795,
    description: "Bella+Canvas 3413",
    catalogImageUrl: "https://files.cdn.printful.com/upload/product-catalog-img/7f/7f84bc900e266780cb31f3d28e41c7c0_l",
    availableColors: [
      { name: "Solid White Triblend", hex: "#ffffff", imageUrl: "https://files.cdn.printful.com/products/162/16797_1719904959.jpg" },
      { name: "Solid Black Triblend", hex: "#101211", imageUrl: "https://files.cdn.printful.com/products/162/6589_1719905671.jpg" },
      { name: "Athletic Grey Triblend", hex: "#a49895", imageUrl: "https://files.cdn.printful.com/products/162/6477_1719905039.jpg" },
      { name: "Navy Triblend", hex: "#464d7e", imageUrl: "https://files.cdn.printful.com/products/162/6557_1719905506.jpg" },
      { name: "Blue Triblend", hex: "#62749b", imageUrl: "https://files.cdn.printful.com/products/162/6493_1719905103.jpg" },
      { name: "Red Triblend", hex: "#da5154", imageUrl: "https://files.cdn.printful.com/products/162/6581_1719905649.jpg" },
    ],
  },
  "gildan-5000-classic": {
    id: "gildan-5000-classic",
    name: "Classic Tee",
    podCostCents: 925,
    description: "Gildan 5000",
    catalogImageUrl: "https://files.cdn.printful.com/o/upload/product-catalog-img/51/5137d67bedbf56010d1daa04555a6d03_l",
    availableColors: [
      { name: "White", hex: "#fffefa", imageUrl: "https://files.cdn.printful.com/products/438/11580_1693310960.jpg" },
      { name: "Black", hex: "#141313", imageUrl: "https://files.cdn.printful.com/products/438/11550_1642678229.jpg" },
      { name: "Navy", hex: "#1a2330", imageUrl: "https://files.cdn.printful.com/products/438/11565_1642678321.jpg" },
      { name: "Red", hex: "#d80019", imageUrl: "https://files.cdn.printful.com/products/438/11570_1642678353.jpg" },
      { name: "Forest Green", hex: "#1A3B23", imageUrl: "https://files.cdn.printful.com/products/438/20457_1725449019.jpg" },
      { name: "Sport Grey", hex: "#c4c0be", imageUrl: "https://files.cdn.printful.com/products/438/11575_1642678405.jpg" },
      { name: "Dark Heather", hex: "#595959", imageUrl: "https://files.cdn.printful.com/products/438/15847_1661693946.jpg" },
      { name: "Gold", hex: "#ffb22d", imageUrl: "https://files.cdn.printful.com/products/438/15853_1664354988.jpg" },
    ],
  },
  "gildan-64000-softstyle": {
    id: "gildan-64000-softstyle",
    name: "Softstyle Tee",
    podCostCents: 944,
    description: "Gildan 64000",
    catalogImageUrl: "https://files.cdn.printful.com/o/upload/product-catalog-img/ed/ed05176d095254c9a84c5ca365025a51_l",
    availableColors: [
      { name: "White", hex: "#ffffff", imageUrl: "https://files.cdn.printful.com/products/12/597_1653477339.jpg" },
      { name: "Black", hex: "#0e0e0e", imageUrl: "https://files.cdn.printful.com/products/12/474_1772009316.jpg" },
      { name: "Navy", hex: "#0f1830", imageUrl: "https://files.cdn.printful.com/products/12/620_1653477293.jpg" },
      { name: "Red", hex: "#FF1B2B", imageUrl: "https://files.cdn.printful.com/products/12/623_1725616797.jpg" },
      { name: "Forest Green", hex: "#2a3d29", imageUrl: "https://files.cdn.printful.com/products/12/484_1772808422.jpg" },
      { name: "Sport Grey", hex: "#d1d2d6", imageUrl: "https://files.cdn.printful.com/products/12/627_1653477316.jpg" },
      { name: "Dark Heather", hex: "#424848", imageUrl: "https://files.cdn.printful.com/products/12/607_1653477262.jpg" },
    ],
  },
  "gildan-18000-crewneck": {
    id: "gildan-18000-crewneck",
    name: "Crewneck Sweatshirt",
    podCostCents: 1879,
    description: "Gildan 18000",
    catalogImageUrl: "https://files.cdn.printful.com/o/upload/product-catalog-img/c4/c45dccb582df772f84fcafde9b726096_l",
    availableColors: [
      { name: "White", hex: "#ffffff", imageUrl: "https://files.cdn.printful.com/products/145/5426_1753765555.jpg" },
      { name: "Black", hex: "#0b0b0b", imageUrl: "https://files.cdn.printful.com/products/145/5434_1753765555.jpg" },
      { name: "Navy", hex: "#050c1d", imageUrl: "https://files.cdn.printful.com/products/145/5498_1753765555.jpg" },
      { name: "Sport Grey", hex: "#ccccce", imageUrl: "https://files.cdn.printful.com/products/145/5514_1753765555.jpg" },
      { name: "Dark Heather", hex: "#46484d", imageUrl: "https://files.cdn.printful.com/products/145/10833_1753765555.jpg" },
      { name: "Forest Green", hex: "#1A3626", imageUrl: "https://files.cdn.printful.com/products/145/18763_1753765555.jpg" },
    ],
  },
  "ch-m2580-hoodie": {
    id: "ch-m2580-hoodie",
    name: "Premium Hoodie",
    podCostCents: 2729,
    description: "Cotton Heritage M2580",
    catalogImageUrl: "https://files.cdn.printful.com/o/upload/product-catalog-img/0e/0e62ae87da7d32dfb60d6dadc3744346_l",
    availableColors: [
      { name: "White", hex: "#ffffff", imageUrl: "https://files.cdn.printful.com/products/380/10774_1759916354.jpg" },
      { name: "Black", hex: "#080808", imageUrl: "https://files.cdn.printful.com/products/380/10779_1759916354.jpg" },
      { name: "Navy Blazer", hex: "#171f2c", imageUrl: "https://files.cdn.printful.com/products/380/11491_1759916354.jpg" },
      { name: "Carbon Grey", hex: "#c7c3be", imageUrl: "https://files.cdn.printful.com/products/380/10784_1759916354.jpg" },
      { name: "Forest Green", hex: "#335231", imageUrl: "https://files.cdn.printful.com/products/380/16162_1759916354.jpg" },
      { name: "Maroon", hex: "#7d263a", imageUrl: "https://files.cdn.printful.com/products/380/11486_1759916354.jpg" },
      { name: "Team Royal", hex: "#1b43ae", imageUrl: "https://files.cdn.printful.com/products/380/13905_1759916354.jpg" },
      { name: "Team Red", hex: "#FF2D41", imageUrl: "https://files.cdn.printful.com/products/380/20278_1759916354.jpg" },
    ],
  },
  "cc-1717-garment-dyed": {
    id: "cc-1717-garment-dyed",
    name: "Garment-Dyed Tee",
    podCostCents: 1529,
    description: "Comfort Colors 1717",
    catalogImageUrl: "https://files.cdn.printful.com/o/upload/product-catalog-img/6d/6d7501c1e4b984392a258054bf0cd145_l",
    availableColors: [
      { name: "Ivory", hex: "#fff4d9", imageUrl: "https://files.cdn.printful.com/products/586/16523_1759238043.jpg" },
      { name: "Black", hex: "#1b1b1c", imageUrl: "https://files.cdn.printful.com/products/586/15114_1759238040.jpg" },
      { name: "Blue Jean", hex: "#707e8d", imageUrl: "https://files.cdn.printful.com/products/586/16511_1759238040.jpg" },
      { name: "Pepper", hex: "#514f4c", imageUrl: "https://files.cdn.printful.com/products/586/17693_1759238043.jpg" },
      { name: "Watermelon", hex: "#d15c68", imageUrl: "https://files.cdn.printful.com/products/586/15191_1759238043.jpg" },
      { name: "Butter", hex: "#ffe09e", imageUrl: "https://files.cdn.printful.com/products/586/15166_1759238040.jpg" },
      { name: "Brick", hex: "#8d4b54", imageUrl: "https://files.cdn.printful.com/products/586/15161_1759238040.jpg" },
      { name: "Chalky Mint", hex: "#a1f2dc", imageUrl: "https://files.cdn.printful.com/products/586/21513_1759238040.jpg" },
    ],
  },
  "yupoong-6245cm-dad-hat": {
    id: "yupoong-6245cm-dad-hat",
    name: "Dad Hat",
    podCostCents: 1375,
    description: "Yupoong 6245CM",
    catalogImageUrl: "https://files.cdn.printful.com/products/206/product_1584101692.jpg",
    availableColors: [
      { name: "Black", hex: "#181717", imageUrl: "https://files.cdn.printful.com/products/206/7854_1584455281.jpg" },
      { name: "Navy", hex: "#182031", imageUrl: "https://files.cdn.printful.com/products/206/7857_1584455384.jpg" },
      { name: "Khaki", hex: "#b49771", imageUrl: "https://files.cdn.printful.com/products/206/7855_1584455330.jpg" },
      { name: "Light Blue", hex: "#b5cbda", imageUrl: "https://files.cdn.printful.com/products/206/7856_1584455357.jpg" },
      { name: "Stone", hex: "#d6bdad", imageUrl: "https://files.cdn.printful.com/products/206/7859_1584455468.jpg" },
      { name: "Pink", hex: "#fab2ba", imageUrl: "https://files.cdn.printful.com/products/206/7858_1584455412.jpg" },
    ],
  },
  "yupoong-6606-trucker": {
    id: "yupoong-6606-trucker",
    name: "Trucker Hat",
    podCostCents: 1329,
    description: "Yupoong 6606",
    catalogImageUrl: "https://files.cdn.printful.com/products/252/product_1585041529.jpg",
    availableColors: [
      { name: "Black", hex: "#181818", imageUrl: "https://files.cdn.printful.com/products/252/8747_1585041627.jpg" },
      { name: "Black/ White", hex: "#181818", imageUrl: "https://files.cdn.printful.com/products/252/8748_1585041652.jpg" },
      { name: "White", hex: "#FFFFFF", imageUrl: "https://files.cdn.printful.com/products/252/8746_1585041861.jpg" },
      { name: "Navy/ White", hex: "#24303b", imageUrl: "https://files.cdn.printful.com/products/252/8755_1585041765.jpg" },
      { name: "Red", hex: "#c6172f", imageUrl: "https://files.cdn.printful.com/products/252/8754_1585041816.jpg" },
      { name: "Dark Heather Gray", hex: "#434344", imageUrl: "https://files.cdn.printful.com/products/252/20391_1725007490.jpg" },
    ],
  },
  "yupoong-6089m-snapback": {
    id: "yupoong-6089m-snapback",
    name: "Snapback Cap",
    podCostCents: 1689,
    description: "Yupoong 6089M",
    catalogImageUrl: "https://files.cdn.printful.com/products/99/product_1586152798.jpg",
    availableColors: [
      { name: "Black", hex: "#2a2a2a", imageUrl: "https://files.cdn.printful.com/products/99/4792_1586154802.jpg" },
      { name: "Dark Navy", hex: "#15293a", imageUrl: "https://files.cdn.printful.com/products/99/4798_1586154944.jpg" },
      { name: "Dark Grey", hex: "#666061", imageUrl: "https://files.cdn.printful.com/products/99/4797_1586154846.jpg" },
      { name: "Royal Blue", hex: "#10337a", imageUrl: "https://files.cdn.printful.com/products/99/4807_1586155230.jpg" },
    ],
  },
  "yupoong-1501kc-beanie": {
    id: "yupoong-1501kc-beanie",
    name: "Cuffed Beanie",
    podCostCents: 1279,
    description: "Yupoong 1501KC",
    catalogImageUrl: "https://files.cdn.printful.com/products/266/product_1584696677.jpg",
    availableColors: [
      { name: "Black", hex: "#0c0c0c", imageUrl: "https://files.cdn.printful.com/products/266/8936_1584956824.jpg" },
      { name: "Navy", hex: "#141323", imageUrl: "https://files.cdn.printful.com/products/266/8940_1584956844.jpg" },
      { name: "Dark Grey", hex: "#2d2a2a", imageUrl: "https://files.cdn.printful.com/products/266/12881_1627881260.jpg" },
      { name: "Heather Grey", hex: "#a19f9b", imageUrl: "https://files.cdn.printful.com/products/266/8937_1584956885.jpg" },
      { name: "Gold", hex: "#ffa913", imageUrl: "https://files.cdn.printful.com/products/266/12882_1627881265.jpg" },
      { name: "Red", hex: "#b91616", imageUrl: "https://files.cdn.printful.com/products/266/8939_1584956866.jpg" },
    ],
  },
  "white-glossy-mug": {
    id: "white-glossy-mug",
    name: "White Glossy Mug",
    podCostCents: 595,
    description: "11oz Ceramic Mug",
    catalogImageUrl: "https://files.cdn.printful.com/upload/product-catalog-img/8c/8c4ac4a450b8485bc8a6e041a5a23666_l",
    availableColors: [
      { name: "White", hex: "#ffffff", imageUrl: "https://files.cdn.printful.com/products/19/1320_1663762583.jpg" },
    ],
  },
  "econscious-ec8000-tote": {
    id: "econscious-ec8000-tote",
    name: "Eco Tote Bag",
    podCostCents: 1556,
    description: "Econscious EC8000",
    catalogImageUrl: "https://files.cdn.printful.com/upload/product-catalog-img/96/965d2ac3d059e6ec8e9a040ba30e97e4_l",
    availableColors: [
      { name: "Black", hex: "#101010", imageUrl: "https://files.cdn.printful.com/products/367/10457_1582200790.jpg" },
      { name: "Oyster", hex: "#edcea5", imageUrl: "https://files.cdn.printful.com/products/367/10458_1642499411.jpg" },
    ],
  },
}

export type PresetPackId =
  | "school-classic"
  | "team-pack"
  | "event-pack"
  | "community-pack"

export const PRESET_PACKS: Record<
  PresetPackId,
  { name: string; description: string; variantIds: PrintfulVariantId[] }
> = {
  "school-classic": {
    name: "School Classic",
    description: "Best for PTA and school events",
    variantIds: ["bc-3001-tee", "bc-3001y-tee"],
  },
  "team-pack": {
    name: "Team Pack",
    description: "Best for sports teams and clubs",
    variantIds: ["bc-3001-tee", "bc-3501-ls"],
  },
  "event-pack": {
    name: "Event Pack",
    description: "Best for festivals and reunions",
    variantIds: ["bc-3001-tee", "gildan-18500-hoodie"],
  },
  "community-pack": {
    name: "Community Pack",
    description: "Best for nonprofits and charities",
    variantIds: ["bc-3001-tee", "atc-bg150-tote"],
  },
}

const PLATFORM_FEE_RATE = 0.09
const POD_BUFFER_RATE = 0.10
const STRIPE_RATE = 0.034
const STRIPE_FIXED_CENTS = 30

export function calculateMargin(
  retailPriceCents: number,
  podCostCents: number
): {
  podWithBufferCents: number
  platformFeeCents: number
  stripeFeesCents: number
  profitCents: number
} {
  const podWithBufferCents = Math.round(podCostCents * (1 + POD_BUFFER_RATE))
  const platformFeeCents = Math.round(retailPriceCents * PLATFORM_FEE_RATE)
  const stripeFeesCents = Math.round(retailPriceCents * STRIPE_RATE) + STRIPE_FIXED_CENTS
  const profitCents = retailPriceCents - podWithBufferCents - platformFeeCents - stripeFeesCents
  return { podWithBufferCents, platformFeeCents, stripeFeesCents, profitCents }
}

export function itemsNeededForGoal(goalCents: number, profitPerItemCents: number): number {
  if (profitPerItemCents <= 0) return Infinity
  return Math.ceil(goalCents / profitPerItemCents)
}

// Default retail price suggestion: the first whole dollar at or above 2×
// production cost — the standard POD fundraising markup. Guarantees a healthy
// positive margin for every catalog item (profit ≈ 0.65 × cost − 30¢).
export function suggestedRetailCents(podCostCents: number): number {
  return Math.ceil((podCostCents * 2) / 100) * 100
}

// US standard shipping, charged to the buyer at checkout. Printful bills the
// platform owner product cost + shipping per order, so checkout collects
// shipping from the buyer and recovers it via the Stripe application fee.
// Rates approximate Printful's published US standard rates (verified 2026-07);
// the POD buffer absorbs drift. Review https://www.printful.com/shipping
// whenever the catalog changes.
export const SHIPPING_RATES: Record<string, { firstCents: number; additionalCents: number }> = {
  "bc-3001-tee":            { firstCents: 469, additionalCents: 220 },
  "bc-3001y-tee":           { firstCents: 469, additionalCents: 220 },
  "bc-3501-ls":             { firstCents: 469, additionalCents: 220 },
  "bc-3413-triblend":       { firstCents: 469, additionalCents: 220 },
  "gildan-5000-classic":    { firstCents: 469, additionalCents: 220 },
  "gildan-64000-softstyle": { firstCents: 469, additionalCents: 220 },
  "gildan-18000-crewneck":  { firstCents: 749, additionalCents: 260 },
  "gildan-18500-hoodie":    { firstCents: 749, additionalCents: 260 },
  "ch-m2580-hoodie":        { firstCents: 749, additionalCents: 260 },
  "cc-1717-garment-dyed":   { firstCents: 469, additionalCents: 220 },
  "yupoong-6245cm-dad-hat": { firstCents: 419, additionalCents: 209 },
  "yupoong-6606-trucker":   { firstCents: 419, additionalCents: 209 },
  "yupoong-6089m-snapback": { firstCents: 419, additionalCents: 209 },
  "yupoong-1501kc-beanie":  { firstCents: 419, additionalCents: 209 },
  "white-glossy-mug":       { firstCents: 799, additionalCents: 449 },
  "atc-bg150-tote":         { firstCents: 469, additionalCents: 220 },
  "econscious-ec8000-tote": { firstCents: 469, additionalCents: 220 },
}

// Fallback for catalog items added without a rate entry — errs high on purpose.
export const DEFAULT_SHIPPING_RATE = { firstCents: 799, additionalCents: 300 }

// One order ships as one package: the highest first-item rate applies once,
// every remaining unit adds its own additional-item rate.
export function estimateShippingCents(
  items: { printfulVariantId: string; quantity: number }[]
): number {
  if (items.length === 0) return 0
  let best: { firstCents: number; additionalCents: number } | null = null
  let additionalTotalCents = 0
  for (const item of items) {
    const rate = SHIPPING_RATES[item.printfulVariantId] ?? DEFAULT_SHIPPING_RATE
    additionalTotalCents += rate.additionalCents * item.quantity
    if (!best || rate.firstCents > best.firstCents) best = rate
  }
  if (!best) return 0
  return best.firstCents + additionalTotalCents - best.additionalCents
}

// The platform owner pays Printful (POD + shipping) and Stripe processing out
// of pocket, so the application fee must recover those costs on top of the
// platform fee itself. The org then receives: item subtotal − POD(+buffer)
// − platform fee − Stripe estimate, matching calculateMargin's display.
export function calculateCheckoutApplicationFee(params: {
  itemSubtotalCents: number
  podCostCents: number
  shippingCents: number
  feeRate?: number
}): number {
  const { itemSubtotalCents, podCostCents, shippingCents, feeRate = PLATFORM_FEE_RATE } = params
  const podWithBufferCents = Math.round(podCostCents * (1 + POD_BUFFER_RATE))
  const platformFeeCents = Math.round(itemSubtotalCents * feeRate)
  const stripeFeesCents =
    Math.round((itemSubtotalCents + shippingCents) * STRIPE_RATE) + STRIPE_FIXED_CENTS
  return podWithBufferCents + shippingCents + platformFeeCents + stripeFeesCents
}

// Verified Printful catalog product IDs (from GET https://api.printful.com/products)
// Color default = "White". Variant ID per size resolved at order time via GET /products/{id}/variants.
// Note: ATC BG150 is not in Printful's catalog — AS Colour 1001 Cotton Tote Bag (ID 641) is used instead.
export const PRINTFUL_PRODUCT_IDS: Record<PrintfulVariantId, number> = {
  "bc-3001-tee": 71,               // Unisex Staple T-Shirt | Bella + Canvas 3001
  "bc-3001y-tee": 307,             // Youth Staple Tee | Bella + Canvas 3001Y
  "bc-3501-ls": 356,               // Unisex Long Sleeve Tee | Bella + Canvas 3501
  "bc-3413-triblend": 162,         // Unisex Tri-Blend T-Shirt | Bella + Canvas 3413
  "gildan-5000-classic": 438,      // Unisex Classic Tee | Gildan 5000
  "gildan-64000-softstyle": 12,    // Unisex Basic Softstyle T-Shirt | Gildan 64000
  "gildan-18000-crewneck": 145,    // Unisex Crew Neck Sweatshirt | Gildan 18000
  "gildan-18500-hoodie": 146,      // Unisex Heavy Blend Hoodie | Gildan 18500
  "ch-m2580-hoodie": 380,          // Unisex Premium Pullover Hoodie | Cotton Heritage M2580
  "cc-1717-garment-dyed": 586,     // Unisex Garment-Dyed Heavyweight T-Shirt | Comfort Colors 1717
  "yupoong-6245cm-dad-hat": 206,   // Classic Dad Hat | Yupoong 6245CM
  "yupoong-6606-trucker": 252,     // Retro Trucker Hat | Yupoong 6606
  "yupoong-6089m-snapback": 99,    // Classic Snapback | Yupoong 6089M
  "yupoong-1501kc-beanie": 266,    // Cuffed Beanie | Yupoong 1501KC
  "white-glossy-mug": 19,          // White Glossy Mug (11oz ceramic)
  "atc-bg150-tote": 641,           // Cotton Tote Bag | AS Colour 1001 (ATC BG150 not available in Printful)
  "econscious-ec8000-tote": 367,   // Eco Tote Bag | Econscious EC8000
}

export const PRINTFUL_DEFAULT_COLOR = "White"

export function getColorImage(variantId: PrintfulVariantId, colorName: string): string {
  const variant = PRINTFUL_VARIANTS[variantId]
  const color = variant.availableColors.find((c) => c.name === colorName)
  return color?.imageUrl ?? variant.catalogImageUrl
}
