import { db } from "@/lib/db/client"
import { organizations, campaigns, designs, orders } from "@/lib/db/schema"
import { eq, and, inArray, count } from "drizzle-orm"
import { r2KeyFromUrl, deleteFromR2 } from "@/lib/providers/r2"
import { stripe } from "@/lib/providers/stripe"

/**
 * Everything that must be untrue before an organization can be erased.
 *
 * Deletion is irreversible and the organization has no Stripe dashboard of its
 * own, so anything unresolved has to block rather than warn. Where a state
 * cannot be established — a Stripe call that fails — deletion is refused too:
 * an unknown is never treated as an all-clear.
 */
export type DeletionBlocker =
  | { kind: "orders"; count: number }
  | { kind: "active_campaigns"; count: number }
  | { kind: "stripe_balance"; amountCents: number }
  | { kind: "stripe_unreachable" }

export type DeleteOutcome =
  | { ok: true; deletedDesigns: number; orphanedFiles: number }
  | { ok: false; error: string; orderCount?: number }

/**
 * Whether an organization may be hard-deleted.
 *
 * Deletion is only offered while nothing irreversible has happened. Once a
 * single order exists there is money, a buyer, and a tax record attached, so
 * the organization is closed rather than erased — see `closeOrg`.
 */
export async function orgOrderCount(orgId: string): Promise<number> {
  const orgCampaigns = await db.query.campaigns.findMany({ where: eq(campaigns.orgId, orgId) })
  const ids = orgCampaigns.map((c) => c.id)
  if (ids.length === 0) return 0
  const [{ n }] = await db
    .select({ n: count() })
    .from(orders)
    .where(inArray(orders.campaignId, ids))
  return n
}

/** Typed-confirmation check, shared by the UI and the server action. */
export function confirmationMatches(typed: string | null, orgName: string): boolean {
  return typed !== null && typed.trim() === orgName.trim()
}

/**
 * Money still sitting in the organization's connected account, in cents.
 *
 * Returns `null` when Stripe could not answer, which callers must treat as a
 * blocker rather than as zero. An account Stripe reports as missing is a real
 * zero: there is nothing left to strand.
 */
async function connectedAccountBalanceCents(stripeAccountId: string): Promise<number | null> {
  try {
    const balance = await stripe.balance.retrieve({}, { stripeAccount: stripeAccountId })
    const sum = (entries: { amount: number }[]) => entries.reduce((s, b) => s + b.amount, 0)
    return sum(balance.available) + sum(balance.pending)
  } catch (err) {
    const code = (err as { code?: string; statusCode?: number })
    // The account no longer exists at Stripe — nothing can be stranded in it.
    if (code?.statusCode === 404 || code?.code === "account_invalid") return 0
    console.warn(`[org-lifecycle] balance check failed for ${stripeAccountId}`, err)
    return null
  }
}

/**
 * Collect every reason this organization must not be deleted.
 *
 * Checked here rather than inferred from a single counter, because each state
 * strands something different: orders are financial records, an active
 * campaign can take a payment a moment after the check, and a connected
 * account balance is money the organization cannot reach any other way.
 */
export async function getDeletionBlockers(orgId: string): Promise<DeletionBlocker[]> {
  const blockers: DeletionBlocker[] = []

  const orderCount = await orgOrderCount(orgId)
  if (orderCount > 0) blockers.push({ kind: "orders", count: orderCount })

  // An active campaign is publicly orderable. Requiring it to be closed first
  // removes the window between checking for orders and deleting the rows.
  const active = await db.query.campaigns.findMany({
    where: and(eq(campaigns.orgId, orgId), eq(campaigns.status, "active")),
  })
  if (active.length > 0) blockers.push({ kind: "active_campaigns", count: active.length })

  const org = await db.query.organizations.findFirst({ where: eq(organizations.id, orgId) })
  if (org?.stripeAccountId) {
    const balance = await connectedAccountBalanceCents(org.stripeAccountId)
    if (balance === null) blockers.push({ kind: "stripe_unreachable" })
    else if (balance > 0) blockers.push({ kind: "stripe_balance", amountCents: balance })
  }

  return blockers
}

/** Human-readable explanation of a blocker, and what to do about it. */
export function describeBlocker(blocker: DeletionBlocker, orgName: string): string {
  switch (blocker.kind) {
    case "orders":
      return `${orgName} has ${blocker.count} ${blocker.count === 1 ? "order" : "orders"}. Orders are financial records and cannot be erased — close the organization instead.`
    case "active_campaigns":
      return `${blocker.count} ${blocker.count === 1 ? "campaign is" : "campaigns are"} still live and can take an order at any moment. Close them first.`
    case "stripe_balance":
      return `There is ${formatCentsPlain(blocker.amountCents)} still in this organization's payout account. Deleting now would leave it unreachable — wait for Stripe to pay it out.`
    case "stripe_unreachable":
      return "We could not confirm the balance of this organization's payout account. Deletion is blocked until we can — try again shortly."
  }
}

function formatCentsPlain(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100)
}

/**
 * Permanently delete an organization that has never taken an order.
 *
 * The order count is re-checked inside this function rather than trusted from
 * the caller: a checkout completing between rendering the page and pressing
 * the button would otherwise erase a paid order's campaign.
 *
 * Members, invitations, campaigns, campaign products and designs are removed
 * by the schema's cascades. Uploaded design files are not, so their keys are
 * collected first and deleted from storage afterwards.
 */
export async function deleteOrgCascade(orgId: string): Promise<DeleteOutcome> {
  const org = await db.query.organizations.findFirst({ where: eq(organizations.id, orgId) })
  if (!org) return { ok: false, error: "Organization not found" }

  // Re-checked here, not trusted from the page that rendered the button: a
  // checkout completing or a payout landing in between must not slip through.
  const blockers = await getDeletionBlockers(orgId)
  if (blockers.length > 0) {
    const orders = blockers.find((b) => b.kind === "orders")
    return {
      ok: false,
      orderCount: orders?.kind === "orders" ? orders.count : undefined,
      error: blockers.map((b) => describeBlocker(b, org.name)).join(" "),
    }
  }

  // Collect storage keys before the rows that reference them disappear.
  const orgCampaigns = await db.query.campaigns.findMany({
    where: eq(campaigns.orgId, orgId),
    with: { design: true },
  })
  const keys = orgCampaigns
    .flatMap((c) => [c.design?.designFileUrl, c.design?.mockupUrl])
    .map((url) => r2KeyFromUrl(url))
    .filter((k): k is string => k !== null)

  const campaignIds = orgCampaigns.map((c) => c.id)

  await db.transaction(async (tx) => {
    // Explicit rather than relying on cascade ordering, so the intent survives
    // a future schema change that drops an onDelete rule.
    if (campaignIds.length > 0) {
      await tx.delete(designs).where(inArray(designs.campaignId, campaignIds))
    }
    await tx.delete(organizations).where(eq(organizations.id, orgId))
  })

  const { deleted, failed } = await deleteFromR2(keys)
  return { ok: true, deletedDesigns: deleted, orphanedFiles: failed }
}

/**
 * Retire an organization that has orders.
 *
 * Records are kept — they are financial history — but the organization stops
 * trading: campaigns are closed so nothing is publicly orderable, and checkout
 * refuses. Reversible by a platform admin.
 */
export async function closeOrg(orgId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const org = await db.query.organizations.findFirst({ where: eq(organizations.id, orgId) })
  if (!org) return { ok: false, error: "Organization not found" }
  if (org.closedAt) return { ok: false, error: "This organization is already closed" }

  const now = new Date()
  await db.transaction(async (tx) => {
    await tx
      .update(campaigns)
      .set({ status: "closed", updatedAt: now })
      .where(eq(campaigns.orgId, orgId))
    await tx
      .update(organizations)
      .set({ closedAt: now, updatedAt: now })
      .where(eq(organizations.id, orgId))
  })
  return { ok: true }
}

/**
 * Reopen a closed organization. Platform admin only — an organization that
 * closed itself should have to ask, so this is not a self-service toggle.
 *
 * Campaigns are left closed deliberately: reopening the organization restores
 * the ability to trade, but which campaigns should run again is a decision
 * only the organization can make.
 */
export async function reopenOrg(orgId: string): Promise<void> {
  await db
    .update(organizations)
    .set({ closedAt: null, updatedAt: new Date() })
    .where(eq(organizations.id, orgId))
}

/** True when the organization must not take money or appear publicly. */
export function isOrgClosed(org: { closedAt: Date | null }): boolean {
  return org.closedAt !== null
}
