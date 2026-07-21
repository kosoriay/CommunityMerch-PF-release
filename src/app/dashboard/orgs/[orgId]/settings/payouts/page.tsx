import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { auth } from "@/lib/auth"
import { requireOrgAccess } from "@/lib/middleware/require-org-access"
import { getOrg } from "@/lib/orgs"
import { getPayoutStatus, PAYOUT_STATUS_LABEL, PAYOUT_STATUS_TEXT_CLASS } from "@/lib/payouts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { StartPayoutOnboardingForm, UpdateBankDetailsForm, ReplacePayoutAccountForm } from "./_form"

type Props = {
  params: Promise<{ orgId: string }>
  searchParams: Promise<{ return?: string; refresh?: string; error?: string }>
}

const ERROR_MESSAGES: Record<string, string> = {
  forbidden: "Only admins can manage payout settings.",
  "not-found": "Organization not found.",
  "no-account": "Connect a payout account before updating bank details.",
}

export default async function OrgPayoutsSettingsPage({ params, searchParams }: Props) {
  const { orgId } = await params
  const { return: returnParam, refresh: refreshParam, error: errorKey } = await searchParams
  const errorMessage = errorKey ? ERROR_MESSAGES[errorKey] : undefined

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) notFound()

  try {
    await requireOrgAccess(session.user.id, orgId, "admin")
  } catch {
    notFound()
  }

  const org = await getOrg(orgId)
  if (!org) notFound()

  const status = getPayoutStatus(org)

  return (
    <div className="max-w-md mx-auto mt-8 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Payout settings</CardTitle>
          <CardDescription>
            Connect a bank account so your organization can receive funds from campaign orders.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className={`text-sm font-medium ${PAYOUT_STATUS_TEXT_CLASS[status]}`}>
            {PAYOUT_STATUS_LABEL[status]}
            {status === "in_progress" && " — awaiting Stripe verification"}
          </p>

          {refreshParam && (
            <p className="text-sm text-yellow-600">
              ⚠ The connection link expired. Click below to get a new link.
            </p>
          )}
          {returnParam && status !== "ready" && (
            <p className="text-sm text-muted-foreground">
              Your bank account is being verified by Stripe. This may take a few minutes.
            </p>
          )}
          {errorMessage && (
            <p className="text-sm text-red-600 rounded-lg border border-red-200 bg-red-50 p-3">
              {errorMessage}
            </p>
          )}

          {status !== "ready" && (
            <StartPayoutOnboardingForm orgId={orgId} resume={status === "in_progress"} />
          )}
          {status === "ready" && <UpdateBankDetailsForm orgId={orgId} />}
        </CardContent>
      </Card>

      {org.stripeAccountId && (
        <ReplacePayoutAccountForm orgId={orgId} orgName={org.name} />
      )}
    </div>
  )
}
