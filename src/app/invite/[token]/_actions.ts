"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { acceptInvitation } from "@/lib/invitations"

export async function acceptInvitationAction(token: string): Promise<{ error?: string }> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect(`/sign-in?callbackUrl=/invite/${token}`)

  try {
    const { orgId } = await acceptInvitation(token, session.user.id, session.user.email)
    redirect(`/dashboard/orgs/${orgId}`)
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to accept invitation" }
  }
}
