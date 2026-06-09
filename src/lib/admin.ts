import { db } from "@/lib/db/client"
import { organizations, campaigns, orders, user } from "@/lib/db/schema"
import { eq, isNotNull, count, sum, desc } from "drizzle-orm"
import type { InferSelectModel } from "drizzle-orm"

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
