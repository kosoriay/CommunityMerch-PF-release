import { db } from "@/lib/db/client"
import { organizations, orgMembers } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

export type OrgWithMembership = {
  org: typeof organizations.$inferSelect
  membership: typeof orgMembers.$inferSelect
}

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-{2,}/g, "-")
    .slice(0, 50)
    .replace(/-+$/, "")
}

export type OrgNameValidation = { value: string } | { error: string }

/** Validate an organization display name: trimmed, 2–80 chars, must contain a letter or number. */
export function validateOrgName(raw: string | null): OrgNameValidation {
  const value = (raw ?? "").trim()
  if (value.length < 2) return { error: "Name must be at least 2 characters." }
  if (value.length > 80) return { error: "Name must be 80 characters or fewer." }
  if (!generateSlug(value)) return { error: "Name must contain at least one letter or number." }
  return { value }
}

/** Update an organization's display name. Does NOT change the slug — public URLs stay stable. */
export async function updateOrgName(orgId: string, name: string): Promise<void> {
  await db
    .update(organizations)
    .set({ name, updatedAt: new Date() })
    .where(eq(organizations.id, orgId))
}

export async function createOrg(
  name: string,
  userId: string
): Promise<typeof organizations.$inferSelect> {
  const id = crypto.randomUUID()
  const membershipId = crypto.randomUUID()
  const now = new Date()
  let slug = generateSlug(name)

  await db.transaction(async (tx) => {
    const existing = await tx.query.organizations.findFirst({
      where: eq(organizations.slug, slug),
    })
    if (existing) {
      slug = `${slug}-${Date.now().toString(36)}`
    }
    await tx.insert(organizations).values({ id, name, slug, createdAt: now, updatedAt: now })
    await tx.insert(orgMembers).values({
      id: membershipId,
      orgId: id,
      userId,
      role: "admin",
      createdAt: now,
    })
  })

  return {
    id,
    name,
    slug,
    stripeAccountId: null,
    stripeOnboardingComplete: false,
    isInternal: false,
    discountCodeId: null,
    suspendedAt: null,
    createdAt: now,
    updatedAt: now,
  }
}

export async function getOrgsForUser(userId: string): Promise<OrgWithMembership[]> {
  const memberships = await db.query.orgMembers.findMany({
    where: eq(orgMembers.userId, userId),
    with: { org: true },
  })

  return memberships.map((m) => {
    const { org, ...membership } = m
    return { org, membership }
  })
}

export async function getOrg(orgId: string): Promise<typeof organizations.$inferSelect | null> {
  return (
    (await db.query.organizations.findFirst({
      where: eq(organizations.id, orgId),
    })) ?? null
  )
}

export type OrgMemberWithUser = typeof orgMembers.$inferSelect & {
  user: typeof import("./db/schema").user.$inferSelect
}

export async function getOrgMembers(orgId: string): Promise<OrgMemberWithUser[]> {
  return db.query.orgMembers.findMany({
    where: eq(orgMembers.orgId, orgId),
    with: { user: true },
  }) as Promise<OrgMemberWithUser[]>
}
