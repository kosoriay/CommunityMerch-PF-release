import { db } from "@/lib/db/client"
import { invitations, orgMembers, organizations, user } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"
import { Resend } from "resend"
import type { OrgRole } from "@/lib/middleware/require-org-access"

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

export async function createInvitation(
  orgId: string,
  email: string,
  role: OrgRole,
  invitedBy: string
): Promise<typeof invitations.$inferSelect> {
  const id = crypto.randomUUID()
  const tokenBytes = crypto.getRandomValues(new Uint8Array(32))
  const token = Buffer.from(tokenBytes).toString("hex")
  const now = new Date()
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) // 7 days

  await db.insert(invitations).values({
    id,
    orgId,
    email,
    role,
    token,
    invitedBy,
    expiresAt,
    createdAt: now,
  })

  return (await db.query.invitations.findFirst({ where: eq(invitations.id, id) }))!
}

export async function sendInvitationEmail(
  invitation: typeof invitations.$inferSelect,
  orgName: string
): Promise<void> {
  const appUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3000"
  const url = `${appUrl}/invite/${invitation.token}`

  if (!resend) {
    console.log(`[invite] ${invitation.email} → ${url}`)
    return
  }

  await resend.emails.send({
    from: process.env.EMAIL_FROM ?? "noreply@localhost",
    to: invitation.email,
    subject: `You're invited to join ${orgName}`,
    html: `<p>You've been invited to join <strong>${orgName}</strong> as a ${invitation.role}.</p><p><a href="${encodeURI(url)}">Accept invitation</a> — expires in 7 days.</p>`,
  })
}

export async function getInvitationByToken(
  token: string
): Promise<(typeof invitations.$inferSelect & { org: typeof organizations.$inferSelect }) | null> {
  const inv = await db.query.invitations.findFirst({
    where: eq(invitations.token, token),
    with: { org: true },
  })
  return inv ?? null
}

export async function acceptInvitation(
  token: string,
  userId: string,
  userEmail: string
): Promise<{ orgId: string }> {
  const inv = await db.query.invitations.findFirst({
    where: eq(invitations.token, token),
  })

  if (!inv) throw new Error("Invitation not found")
  if (inv.acceptedAt) throw new Error("Invitation already used")
  if (inv.expiresAt < new Date()) throw new Error("Invitation expired")
  if (inv.email.toLowerCase() !== userEmail.toLowerCase()) {
    throw new Error("This invitation was sent to a different email address")
  }

  const existingMembership = await db.query.orgMembers.findFirst({
    where: and(eq(orgMembers.orgId, inv.orgId), eq(orgMembers.userId, userId)),
  })
  if (existingMembership) throw new Error("You're already a member of this organization")

  await db.transaction(async (tx) => {
    await tx.insert(orgMembers).values({
      id: crypto.randomUUID(),
      orgId: inv.orgId,
      userId,
      role: inv.role,
      createdAt: new Date(),
    })
    await tx
      .update(invitations)
      .set({ acceptedAt: new Date() })
      .where(eq(invitations.id, inv.id))
  })

  return { orgId: inv.orgId }
}
