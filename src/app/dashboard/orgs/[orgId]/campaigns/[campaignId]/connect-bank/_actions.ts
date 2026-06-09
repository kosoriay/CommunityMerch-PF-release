"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { requireOrgAccess } from "@/lib/middleware/require-org-access"
import { stripe } from "@/lib/providers/stripe"
import { db } from "@/lib/db/client"
import { organizations } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

export async function createConnectLinkAction(
  orgId: string,
  campaignId: string,
  _formData: FormData
): Promise<void> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/sign-in")

  try {
    await requireOrgAccess(session.user.id, orgId, "admin")
  } catch {
    redirect(`/dashboard/orgs/${orgId}/campaigns/${campaignId}/connect-bank?error=forbidden`)
  }

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, orgId),
  })
  if (!org) {
    redirect(`/dashboard/orgs/${orgId}/campaigns/${campaignId}/connect-bank?error=not-found`)
  }

  const appUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3000"
  const returnUrl = `${appUrl}/dashboard/orgs/${orgId}/campaigns/${campaignId}/connect-bank?return=1`
  const refreshUrl = `${appUrl}/dashboard/orgs/${orgId}/campaigns/${campaignId}/connect-bank?refresh=1`

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

  const accountLink = await stripe.accountLinks.create({
    account: stripeAccountId,
    return_url: returnUrl,
    refresh_url: refreshUrl,
    type: "account_onboarding",
  })

  redirect(accountLink.url)
}
