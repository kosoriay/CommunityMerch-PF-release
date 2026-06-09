"use server"

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { requireOrgAccess, type OrgRole } from "@/lib/middleware/require-org-access"
import { createInvitation, sendInvitationEmail } from "@/lib/invitations"
import { getOrg } from "@/lib/orgs"
import { db } from "@/lib/db/client"
import { orgMembers } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"

export async function inviteMemberAction(
  orgId: string,
  formData: FormData
): Promise<{ error?: string }> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return { error: "Not authenticated" }

  try {
    await requireOrgAccess(session.user.id, orgId, "admin")
  } catch {
    return { error: "Only admins can invite members" }
  }

  const email = (formData.get("email") as string | null)?.trim().toLowerCase() ?? ""
  const role = (formData.get("role") as OrgRole | null) ?? "member"

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Enter a valid email address" }
  }
  if (!["admin", "member", "student", "buyer"].includes(role)) {
    return { error: "Invalid role" }
  }

  const org = await getOrg(orgId)
  if (!org) return { error: "Organization not found" }

  const invitation = await createInvitation(orgId, email, role, session.user.id)
  await sendInvitationEmail(invitation, org.name)

  revalidatePath(`/dashboard/orgs/${orgId}/members`)
  return {}
}

export async function removeMemberAction(
  orgId: string,
  memberId: string
): Promise<{ error?: string }> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return { error: "Not authenticated" }

  try {
    await requireOrgAccess(session.user.id, orgId, "admin")
  } catch {
    return { error: "Only admins can remove members" }
  }

  if (memberId === session.user.id) return { error: "You cannot remove yourself" }

  await db
    .delete(orgMembers)
    .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, memberId)))

  revalidatePath(`/dashboard/orgs/${orgId}/members`)
  return {}
}

export async function changeRoleAction(
  orgId: string,
  memberId: string,
  newRole: OrgRole
): Promise<{ error?: string }> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return { error: "Not authenticated" }

  try {
    await requireOrgAccess(session.user.id, orgId, "admin")
  } catch {
    return { error: "Only admins can change roles" }
  }

  if (memberId === session.user.id) return { error: "You cannot change your own role" }
  if (!["admin", "member", "student", "buyer"].includes(newRole)) {
    return { error: "Invalid role" }
  }

  await db
    .update(orgMembers)
    .set({ role: newRole })
    .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, memberId)))

  revalidatePath(`/dashboard/orgs/${orgId}/members`)
  return {}
}
