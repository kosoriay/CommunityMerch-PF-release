"use client"

import { useActionState } from "react"
import { useFormStatus } from "react-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  startPayoutOnboardingAction,
  updateBankDetailsAction,
  replacePayoutAccountAction,
  type ReplaceState,
} from "./_actions"

function SubmitButton({ label, variant }: { label: string; variant?: "outline" }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant={variant} disabled={pending}>
      {pending ? "Redirecting..." : label}
    </Button>
  )
}

export function StartPayoutOnboardingForm({
  orgId,
  resume,
}: {
  orgId: string
  resume: boolean
}) {
  const action = startPayoutOnboardingAction.bind(null, orgId)

  return (
    <form action={action}>
      <SubmitButton label={resume ? "Resume setup" : "Connect payout account"} />
    </form>
  )
}

/**
 * Re-opens Stripe onboarding for the org's existing connected account so
 * admins can update bank/verification details. Stays available after
 * onboarding completes — it must not disappear once status is "ready".
 */
export function UpdateBankDetailsForm({ orgId }: { orgId: string }) {
  const action = updateBankDetailsAction.bind(null, orgId)

  return (
    <form action={action}>
      <SubmitButton label="Update bank details" variant="outline" />
    </form>
  )
}

function ReplaceSubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="destructive" disabled={pending}>
      {pending ? "Replacing..." : "Replace payout account"}
    </Button>
  )
}

/**
 * Replaces the org's connected Stripe account (admin handover). Requires
 * the admin to type the organization's exact name to confirm — this
 * re-routes real money, so the server re-validates the same match via
 * `payoutReplaceConfirmationMatches` regardless of what this form sends.
 */
export function ReplacePayoutAccountForm({ orgId, orgName }: { orgId: string; orgName: string }) {
  const action = replacePayoutAccountAction.bind(null, orgId)
  const [state, formAction] = useActionState<ReplaceState, FormData>(action, undefined)

  return (
    <form action={formAction} className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
      <div className="space-y-1">
        <p className="text-sm font-medium text-destructive">Replace payout account</p>
        <p className="text-sm text-muted-foreground">
          This changes where {orgName}&apos;s money is paid out. A new Stripe account is
          created and publishing/checkout will pause until it&apos;s verified. The current
          account is kept, not deleted. All org admins will be emailed.
        </p>
      </div>
      {state?.error && (
        <div className="text-sm text-red-600" role="alert">{state.error}</div>
      )}
      <div className="space-y-1">
        <Label htmlFor="confirmation">Type the organization name to confirm</Label>
        <Input id="confirmation" name="confirmation" placeholder={orgName} required autoComplete="off" />
      </div>
      <ReplaceSubmitButton />
    </form>
  )
}
