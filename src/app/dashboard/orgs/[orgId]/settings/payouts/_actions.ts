"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { requireOrgAccess } from "@/lib/middleware/require-org-access"
import { stripe } from "@/lib/providers/stripe"
import { db } from "@/lib/db/client"
import { organizations } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { getOrgMembers } from "@/lib/orgs"
import { payoutReplaceConfirmationMatches } from "@/lib/payouts"
import { sendPayoutAccountReplacedEmail } from "@/lib/email"

export type ReplaceState = { error?: string; success?: boolean } | undefined

/** Issue a fresh `account_onboarding` link for an existing connected account. */
async function createOnboardingLink(orgId: string, stripeAccountId: string) {
  const appUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3000"
  const returnUrl = `${appUrl}/dashboard/orgs/${orgId}/settings/payouts?return=1`
  const refreshUrl = `${appUrl}/dashboard/orgs/${orgId}/settings/payouts?refresh=1`

  return stripe.accountLinks.create({
    account: stripeAccountId,
    return_url: returnUrl,
    refresh_url: refreshUrl,
    type: "account_onboarding",
  })
}

/**
 * Org-scoped Stripe Connect onboarding. Moved from the per-campaign
 * connect-bank action: payouts are an org-level setting, not tied to any
 * one campaign. Creates the connected account on first use, then always
 * (re)issues an `account_onboarding` link so admins can resume setup.
 */
export async function startPayoutOnboardingAction(orgId: string, _formData: FormData): Promise<void> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/sign-in")

  try {
    await requireOrgAccess(session.user.id, orgId, "admin")
  } catch {
    redirect(`/dashboard/orgs/${orgId}/settings/payouts?error=forbidden`)
  }

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, orgId),
  })
  if (!org) {
    redirect(`/dashboard/orgs/${orgId}/settings/payouts?error=not-found`)
  }

  let stripeAccountId = org.stripeAccountId

  if (!stripeAccountId) {
    const account = await stripe.accounts.create({
      controller: {
        stripe_dashboard: { type: "none" },
        fees: { payer: "application" },
        losses: { payments: "application" },
        requirement_collection: "application",
      },
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      country: "US",
      email: session.user.email,
    })
    stripeAccountId = account.id
    await db
      .update(organizations)
      .set({ stripeAccountId, updatedAt: new Date() })
      .where(eq(organizations.id, orgId))
  }

  const accountLink = await createOnboardingLink(orgId, stripeAccountId)

  redirect(accountLink.url)
}

/**
 * Re-issue an `account_onboarding` link for the org's EXISTING connected
 * account so admins can update bank/verification details. Never creates a
 * new Stripe account — that only happens in `startPayoutOnboardingAction`
 * (first connect) or the future replace-account flow.
 */
export async function updateBankDetailsAction(orgId: string, _formData: FormData): Promise<void> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/sign-in")

  try {
    await requireOrgAccess(session.user.id, orgId, "admin")
  } catch {
    redirect(`/dashboard/orgs/${orgId}/settings/payouts?error=forbidden`)
  }

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, orgId),
  })
  if (!org) {
    redirect(`/dashboard/orgs/${orgId}/settings/payouts?error=not-found`)
  }

  if (!org.stripeAccountId) {
    redirect(`/dashboard/orgs/${orgId}/settings/payouts?error=no-account`)
  }

  const accountLink = await createOnboardingLink(orgId, org.stripeAccountId)

  redirect(accountLink.url)
}

/**
 * Replaces the org's connected Stripe account for administrator handover.
 * Creates a brand-new connected account, repoints `stripeAccountId` to it,
 * and resets `stripeOnboardingComplete` to false — the org is treated as
 * not-ready (publish + checkout stay gated, see api/checkout/route.ts and
 * the publish action) until the NEW account's `account.updated` webhook
 * confirms `charges_enabled && payouts_enabled`. The previous Stripe
 * account is never deleted or modified; it simply stops being referenced.
 *
 * Gated on an exact typed org-name confirmation (no audit-trail columns —
 * the admin notification email below is the human-facing record).
 */
export async function replacePayoutAccountAction(
  orgId: string,
  _prevState: ReplaceState,
  formData: FormData
): Promise<ReplaceState> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/sign-in")

  try {
    await requireOrgAccess(session.user.id, orgId, "admin")
  } catch {
    return { error: "Only admins can manage payout settings." }
  }

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, orgId),
  })
  if (!org) return { error: "Organization not found." }
  if (!org.stripeAccountId) {
    return { error: "Connect a payout account before it can be replaced." }
  }

  const confirmation = formData.get("confirmation")
  const typedConfirmation = typeof confirmation === "string" ? confirmation : null
  if (!payoutReplaceConfirmationMatches(typedConfirmation, org.name)) {
    return { error: "Type the organization name exactly to confirm." }
  }

  // 1. Create a NEW connected account — same controller config/capabilities
  //    as first-time connect in `startPayoutOnboardingAction`.
  const newAccount = await stripe.accounts.create({
    controller: {
      stripe_dashboard: { type: "none" },
      fees: { payer: "application" },
      losses: { payments: "application" },
      requirement_collection: "application",
    },
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    country: "US",
    email: session.user.email,
  })

  // 2. Repoint the org to the new account and reset readiness. The old
  //    account is intentionally left untouched in Stripe.
  await db
    .update(organizations)
    .set({
      stripeAccountId: newAccount.id,
      stripeOnboardingComplete: false,
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, orgId))

  // 3. Notify org admins by email — this is the audit record. A
  //    notification failure must NOT roll back the completed repoint above
  //    (the DB update is the source of truth), so swallow/log it here and
  //    surface nothing misleading to the user.
  try {
    const members = await getOrgMembers(orgId)
    const admins = members.filter((m) => m.role === "admin")
    const replacedAt = new Date()
    await Promise.all(
      admins.map((admin) =>
        sendPayoutAccountReplacedEmail(admin.user.email, {
          orgName: org.name,
          actorName: session.user.name || session.user.email,
          actorEmail: session.user.email,
          replacedAt,
        })
      )
    )
  } catch (err) {
    console.error("[replacePayoutAccountAction] admin notification failed:", err)
  }

  revalidatePath(`/dashboard/orgs/${orgId}/settings/payouts`)
  revalidatePath(`/dashboard/orgs/${orgId}`)

  // 4. Send the admin straight into onboarding for the new account.
  const accountLink = await createOnboardingLink(orgId, newAccount.id)
  redirect(accountLink.url)
}
