import { count, ne, sum, inArray } from "drizzle-orm"
import { db } from "@/lib/db/client"
import { campaigns, orders, organizations } from "@/lib/db/schema"
import { REVENUE_ORDER_STATUSES } from "@/lib/order-status"

export type LandingStats = {
  totalRaisedCents: number
  campaignsLaunched: number
  organizations: number
}

// Live aggregates for the landing page. Only statuses that represent money the
// platform kept are counted — refunded orders were given back and must not be
// advertised as funds raised. Campaigns count once they leave "draft".
export async function getLandingStats(): Promise<LandingStats> {
  const [{ raised }] = await db
    .select({ raised: sum(orders.totalAmountCents) })
    .from(orders)
    .where(inArray(orders.status, [...REVENUE_ORDER_STATUSES]))
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

// A stat only works as social proof once it's big enough to impress —
// "1 campaign launched" reads as a warning label, not a credential.
// Tiles below these floors are dropped; an empty result means the caller
// skips the whole section (spec: social proof is never fabricated).
export const STAT_TILE_MINIMUMS = {
  raisedCents: 100_000, // $1,000
  campaignsLaunched: 10,
  organizations: 10,
} as const

export function buildStatTiles(stats: LandingStats): StatTile[] {
  const tiles: StatTile[] = []
  if (stats.totalRaisedCents >= STAT_TILE_MINIMUMS.raisedCents) {
    tiles.push({ value: formatWholeDollars(stats.totalRaisedCents), label: "Raised by communities" })
  }
  if (stats.campaignsLaunched >= STAT_TILE_MINIMUMS.campaignsLaunched) {
    tiles.push({ value: String(stats.campaignsLaunched), label: "Campaigns launched" })
  }
  if (stats.organizations >= STAT_TILE_MINIMUMS.organizations) {
    tiles.push({ value: String(stats.organizations), label: "Organizations fundraising" })
  }
  return tiles
}
