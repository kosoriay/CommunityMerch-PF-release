import { count, ne, sum } from "drizzle-orm"
import { db } from "@/lib/db/client"
import { campaigns, orders, organizations } from "@/lib/db/schema"

export type LandingStats = {
  totalRaisedCents: number
  campaignsLaunched: number
  organizations: number
}

// Live aggregates for the landing page. Order statuses run
// pending → paid → fulfilled → shipped → delivered; everything past
// "pending" is real money. Campaigns count once they leave "draft".
export async function getLandingStats(): Promise<LandingStats> {
  const [{ raised }] = await db
    .select({ raised: sum(orders.totalAmountCents) })
    .from(orders)
    .where(ne(orders.status, "pending"))
  const [{ launched }] = await db
    .select({ launched: count() })
    .from(campaigns)
    .where(ne(campaigns.status, "draft"))
  const [{ orgs }] = await db.select({ orgs: count() }).from(organizations)
  return {
    totalRaisedCents: Number(raised ?? 0),
    campaignsLaunched: launched,
    organizations: orgs,
  }
}

export type StatTile = { value: string; label: string }

// Whole dollars for marketing display — cents add noise at this altitude.
function formatWholeDollars(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

// Hide-when-zero: zero tiles are dropped; an empty result means the caller
// skips the whole section (spec: social proof is never fabricated).
export function buildStatTiles(stats: LandingStats): StatTile[] {
  const tiles: StatTile[] = []
  if (stats.totalRaisedCents > 0) {
    tiles.push({ value: formatWholeDollars(stats.totalRaisedCents), label: "Raised by communities" })
  }
  if (stats.campaignsLaunched > 0) {
    tiles.push({ value: String(stats.campaignsLaunched), label: "Campaigns launched" })
  }
  if (stats.organizations > 0) {
    tiles.push({ value: String(stats.organizations), label: "Organizations fundraising" })
  }
  return tiles
}
