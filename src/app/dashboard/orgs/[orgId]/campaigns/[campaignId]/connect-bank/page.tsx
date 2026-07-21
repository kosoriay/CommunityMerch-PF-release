import { redirect } from "next/navigation"

type Props = { params: Promise<{ orgId: string; campaignId: string }> }

/**
 * Payout onboarding moved to the org-level settings page — it's no longer
 * tied to a single campaign. Pricing and publish have already been
 * retargeted to the org payouts settings page directly; this route now only
 * exists as a bookmark redirect for anyone who still has the old URL.
 */
export default async function ConnectBankRedirectPage({ params }: Props) {
  const { orgId } = await params
  redirect(`/dashboard/orgs/${orgId}/settings/payouts`)
}
