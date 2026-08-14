import { db } from "@/lib/db/client"
import { organizations, campaigns, orders, user } from "@/lib/db/schema"
import { eq, isNotNull, count, sum, desc, or, sql } from "drizzle-orm"
import type { InferSelectModel } from "drizzle-orm"
import { parseOrderQuery } from "@/lib/order-search"

export type AdminOrg = InferSelectModel<typeof organizations>

export function formatRevenueDollars(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100)
}

export async function getPlatformStats() {
  const [{ orgCount }] = await db.select({ orgCount: count() }).from(organizations)
  const [{ activeCampaigns }] = await db
    .select({ activeCampaigns: count() })
    .from(campaigns)
    .where(eq(campaigns.status, "active"))
  const [{ orderCount, revenue }] = await db
    .select({ orderCount: count(), revenue: sum(orders.totalAmountCents) })
    .from(orders)
    .where(eq(orders.status, "paid"))
  const [{ suspended }] = await db
    .select({ suspended: count() })
    .from(organizations)
    .where(isNotNull(organizations.suspendedAt))

  return {
    orgCount,
    activeCampaigns,
    orderCount,
    totalRevenueCents: Number(revenue ?? 0),
    suspendedCount: suspended,
  }
}

export async function getRecentOrgs(limit = 5): Promise<AdminOrg[]> {
  return db.query.organizations.findMany({
    orderBy: [desc(organizations.createdAt)],
    limit,
  })
}

export async function getAllOrgs(): Promise<AdminOrg[]> {
  return db.query.organizations.findMany({
    orderBy: [desc(organizations.createdAt)],
  })
}

export async function getAdminOrgById(orgId: string): Promise<AdminOrg | null> {
  const result = await db.query.organizations.findFirst({
    where: eq(organizations.id, orgId),
  })
  return result ?? null
}

export async function suspendOrg(orgId: string): Promise<void> {
  await db.update(organizations)
    .set({ suspendedAt: new Date(), updatedAt: new Date() })
    .where(eq(organizations.id, orgId))
}

export async function unsuspendOrg(orgId: string): Promise<void> {
  await db.update(organizations)
    .set({ suspendedAt: null, updatedAt: new Date() })
    .where(eq(organizations.id, orgId))
}

export async function setInternalOrg(orgId: string, isInternal: boolean): Promise<void> {
  await db.update(organizations)
    .set({ isInternal, updatedAt: new Date() })
    .where(eq(organizations.id, orgId))
}

const ORDER_SEARCH_LIMIT = 50

/**
 * Look up orders for support. A buyer writing in quotes the short id shown on
 * their confirmation page or email, so the id is matched as a prefix; email and
 * name are matched as substrings because we cannot rely on which one they give.
 *
 * With no query, returns the most recent orders so the page is useful on open.
 */
export async function searchOrders(rawQuery: string) {
  const q = parseOrderQuery(rawQuery)

  return db.query.orders.findMany({
    where: q
      ? or(
          sql`lower(${orders.id}) LIKE ${`${q.idPrefix}%`} ESCAPE '\\'`,
          sql`${orders.buyerEmail} LIKE ${`%${q.contains}%`} ESCAPE '\\'`,
          sql`${orders.buyerName} LIKE ${`%${q.contains}%`} ESCAPE '\\'`
        )
      : undefined,
    orderBy: [desc(orders.createdAt)],
    limit: ORDER_SEARCH_LIMIT,
    with: { campaign: { with: { org: true } } },
  })
}

export type AdminOrderSummary = Awaited<ReturnType<typeof searchOrders>>[number]

export async function getPlatformStaff() {
  return db.query.user.findMany({
    where: isNotNull(user.platformRole),
    orderBy: [desc(user.createdAt)],
  })
}

export async function assignPlatformRole(
  userId: string,
  role: "platform_admin" | "platform_staff"
): Promise<void> {
  await db.update(user)
    .set({ platformRole: role, updatedAt: new Date() })
    .where(eq(user.id, userId))
}

export async function removePlatformRole(userId: string): Promise<void> {
  await db.update(user)
    .set({ platformRole: null, updatedAt: new Date() })
    .where(eq(user.id, userId))
}

export async function findUserByEmail(email: string) {
  return db.query.user.findFirst({
    where: eq(user.email, email),
  })
}
