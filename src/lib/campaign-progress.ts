import { db } from "@/lib/db/client"
import { orders, campaigns } from "@/lib/db/schema"
import { eq, inArray } from "drizzle-orm"
import { REVENUE_ORDER_STATUSES } from "@/lib/order-status"
import { orderRefundBreakdown } from "@/lib/order-economics"
import type { OrgRole } from "@/lib/middleware/require-org-access"

export type CampaignProgress = {
  /** Money the organization actually receives — the figure the goal is set against. */
  netRaisedCents: number
  /** What buyers paid, before production, shipping, and fees. Admin/member only. */
  grossSalesCents: number
  itemsSold: number
  orderCount: number
  supporterCount: number
  goalCents: number | null
  /** Null when no goal is set. Uncapped — a campaign may exceed its goal. */
  percentOfGoal: number | null
  daysRemaining: number | null
}

/**
 * Percent of goal. Null when there is no goal to measure against.
 *
 * Deliberately uncapped: a campaign that raised 140% of its goal should be able
 * to say so. Callers that draw a bar clamp separately via `barWidthPercent`.
 */
export function percentOfGoal(netRaisedCents: number, goalCents: number | null): number | null {
  if (!goalCents || goalCents <= 0) return null
  return Math.round((netRaisedCents / goalCents) * 100)
}

/** Bar fill, clamped to [0, 100] — a bar cannot be more than full. */
export function barWidthPercent(percent: number | null): number {
  if (percent === null) return 0
  return Math.max(0, Math.min(100, percent))
}

/** Whole days left, floored at 0. Null when the campaign has no deadline. */
export function daysRemaining(deadline: Date | null, now: Date): number | null {
  if (!deadline) return null
  const ms = deadline.getTime() - now.getTime()
  return Math.max(0, Math.ceil(ms / 86_400_000))
}

type ProgressOrderRow = {
  status: string
  buyerEmail: string | null
  totalAmountCents: number
  campaign: { platformFeeRate: number }
  items: { quantity: number; product: { podCost: number; printfulVariantId: string } }[]
}

/**
 * Fold paid, un-refunded orders into a campaign's totals.
 *
 * The per-order net reuses `orderRefundBreakdown`, the same derivation the
 * refund action uses and which was verified against a live Stripe transfer.
 * One definition of "what the organization gets" rather than two that can drift.
 */
export function summariseOrders(rows: ProgressOrderRow[]): {
  netRaisedCents: number
  grossSalesCents: number
  itemsSold: number
  orderCount: number
  supporterCount: number
} {
  const counted = rows.filter((r) =>
    (REVENUE_ORDER_STATUSES as readonly string[]).includes(r.status)
  )
  const supporters = new Set<string>()
  let netRaisedCents = 0
  let grossSalesCents = 0
  let itemsSold = 0

  for (const row of counted) {
    const { buyerReceivesCents, organizationReturnsCents } = orderRefundBreakdown(row)
    netRaisedCents += organizationReturnsCents
    grossSalesCents += buyerReceivesCents
    itemsSold += row.items.reduce((sum, i) => sum + i.quantity, 0)
    if (row.buyerEmail) supporters.add(row.buyerEmail.toLowerCase())
  }

  return {
    netRaisedCents,
    grossSalesCents,
    itemsSold,
    orderCount: counted.length,
    supporterCount: supporters.size,
  }
}

export async function getCampaignProgress(
  campaignId: string,
  now = new Date()
): Promise<CampaignProgress | null> {
  const campaign = await db.query.campaigns.findFirst({ where: eq(campaigns.id, campaignId) })
  if (!campaign) return null

  const rows = await db.query.orders.findMany({
    where: eq(orders.campaignId, campaignId),
    with: { campaign: true, items: { with: { product: true } } },
  })

  const totals = summariseOrders(rows)
  return {
    ...totals,
    goalCents: campaign.goalAmount,
    percentOfGoal: percentOfGoal(totals.netRaisedCents, campaign.goalAmount),
    daysRemaining: daysRemaining(campaign.deadline, now),
  }
}

export type OrgProgress = {
  netRaisedCents: number
  grossSalesCents: number
  itemsSold: number
  orderCount: number
  supporterCount: number
  activeCampaigns: number
}

export async function getOrgProgress(orgId: string): Promise<OrgProgress> {
  const orgCampaigns = await db.query.campaigns.findMany({ where: eq(campaigns.orgId, orgId) })
  const ids = orgCampaigns.map((c) => c.id)
  if (ids.length === 0) {
    return {
      netRaisedCents: 0, grossSalesCents: 0, itemsSold: 0,
      orderCount: 0, supporterCount: 0, activeCampaigns: 0,
    }
  }

  const rows = await db.query.orders.findMany({
    where: inArray(orders.campaignId, ids),
    with: { campaign: true, items: { with: { product: true } } },
  })

  return {
    ...summariseOrders(rows),
    activeCampaigns: orgCampaigns.filter((c) => c.status === "active").length,
  }
}

// ── Visibility ─────────────────────────────────────────────────────────────

export type ProgressViewer = OrgRole | "public"

export type ProgressVisibility = {
  /** Percent, items sold, supporters, days left — everyone sees these. */
  showProgress: boolean
  /** Dollars raised and the goal amount. */
  showAmounts: boolean
  /** Gross sales, platform fee, production cost, net payout. */
  showPayoutBreakdown: boolean
}

/**
 * The single source of truth for who may see what, from the requirements
 * matrix in `docs/1-requirements/requirements.md`. No page decides for itself.
 *
 * Students and the public never see the payout breakdown, whatever the display
 * mode — the campaign's display setting governs the headline amount only.
 */
export function progressVisibility(
  viewer: ProgressViewer,
  amountDisplayMode: "percent_only" | "show_amount"
): ProgressVisibility {
  const isStaff = viewer === "admin" || viewer === "member"
  return {
    showProgress: true,
    showAmounts: isStaff || amountDisplayMode === "show_amount",
    showPayoutBreakdown: isStaff,
  }
}
