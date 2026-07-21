export type PayoutStatus = "not_setup" | "in_progress" | "ready"

export type PayoutStatusOrg = {
  stripeAccountId?: string | null
  stripeOnboardingComplete?: boolean | null
}

/**
 * Derive an organization's payout readiness from its Stripe fields.
 * "ready" is only true once the `account.updated` webhook has confirmed
 * `charges_enabled && payouts_enabled` (see src/app/api/webhooks/stripe/route.ts) —
 * that webhook is the sole writer of `stripeOnboardingComplete`.
 */
export function getPayoutStatus(org: PayoutStatusOrg): PayoutStatus {
  if (org.stripeOnboardingComplete === true) return "ready"
  if (org.stripeAccountId) return "in_progress"
  return "not_setup"
}

export const PAYOUT_STATUS_LABEL: Record<PayoutStatus, string> = {
  not_setup: "Not set up",
  in_progress: "In progress",
  ready: "Ready to accept funds",
}

/** Text color class per payout status, shared by every page that renders it. */
export const PAYOUT_STATUS_TEXT_CLASS: Record<PayoutStatus, string> = {
  not_setup: "text-muted-foreground",
  in_progress: "text-yellow-600",
  ready: "text-green-700",
}

/**
 * Confirm a typed org-name matches exactly, after trimming both sides — the
 * sole gate on the destructive replace-payout-account flow (see
 * `replacePayoutAccountAction`). Case-sensitive and exact on purpose: this
 * re-points where the organization's money is paid out, so a "close enough"
 * typo must never confirm the change.
 */
export function payoutReplaceConfirmationMatches(
  input: string | null | undefined,
  orgName: string
): boolean {
  const typed = (input ?? "").trim()
  if (typed.length === 0) return false
  return typed === orgName.trim()
}
