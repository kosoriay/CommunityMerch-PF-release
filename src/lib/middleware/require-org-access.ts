import { db } from "@/lib/db/client"
import { orgMembers } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"

export type OrgRole = "admin" | "member" | "student" | "buyer"

const ROLE_RANK: Record<OrgRole, number> = {
  buyer: 0,
  student: 1,
  member: 2,
  admin: 3,
}

export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ForbiddenError"
  }
}

export function hasRole(userRole: OrgRole, minRole: OrgRole): boolean {
  return ROLE_RANK[userRole] >= ROLE_RANK[minRole]
}

export async function requireOrgAccess(
  userId: string,
  orgId: string,
  minRole: OrgRole = "member"
): Promise<typeof orgMembers.$inferSelect> {
  const membership = await db.query.orgMembers.findFirst({
    where: and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)),
  })

  if (!membership) throw new ForbiddenError("Not a member of this org")
  if (!hasRole(membership.role, minRole)) {
    throw new ForbiddenError("Insufficient role")
  }

  return membership
}
