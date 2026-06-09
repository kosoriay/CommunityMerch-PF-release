import { headers } from "next/headers"
import { notFound } from "next/navigation"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { requireOrgAccess } from "@/lib/middleware/require-org-access"
import { getCampaign } from "@/lib/campaigns"
import { db } from "@/lib/db/client"
import { organizations } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { createConnectLinkAction } from "./_actions"
import { buttonVariants } from "@/components/ui/button"

type Props = {
  params: Promise<{ orgId: string; campaignId: string }>
  searchParams: Promise<{ return?: string; refresh?: string; error?: string }>
}

const ERROR_MESSAGES: Record<string, string> = {
  forbidden: "Only admins can connect a bank account.",
  "not-found": "Organization not found.",
}

export default async function ConnectBankPage({ params, searchParams }: Props) {
  const { orgId, campaignId } = await params
  const { return: returnParam, refresh: refreshParam, error: errorKey } = await searchParams
  const errorMessage = errorKey ? ERROR_MESSAGES[errorKey] : undefined
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) notFound()

  let membership
  try {
    membership = await requireOrgAccess(session.user.id, orgId, "member")
  } catch {
    notFound()
  }

  const campaign = await getCampaign(campaignId)
  if (!campaign || campaign.orgId !== orgId) notFound()

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, orgId),
  })
  if (!org) notFound()

  const isAdmin = membership.role === "admin"
  const isConnected = !!org.stripeOnboardingComplete
  const boundAction = createConnectLinkAction.bind(null, orgId, campaignId)

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
          <span>Step 3 of 4</span>
          <span>·</span>
          <span className="font-medium text-foreground">Bank Account</span>
        </div>
        <h1 className="text-2xl font-semibold text-[#2E4057]">{campaign.title}</h1>
      </div>

      <div className="rounded-lg border bg-white p-6 space-y-4">
        <h2 className="font-semibold">Connect your bank account</h2>
        <p className="text-sm text-muted-foreground">
          Stripe verifies your identity so funds can be sent directly to your bank account after orders are paid.
          This is required before you can publish and accept orders.
        </p>

        {refreshParam && (
          <p className="text-sm text-yellow-600">
            ⚠ The connection link expired. Click &quot;Connect Bank Account&quot; to get a new link.
          </p>
        )}

        {errorMessage && (
          <p className="text-sm text-red-600 rounded-lg border border-red-200 bg-red-50 p-3">
            {errorMessage}
          </p>
        )}

        {isConnected ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-700 font-medium">
              <span>✓</span>
              <span>Bank account connected</span>
            </div>
            <Link
              href={`/dashboard/orgs/${orgId}/campaigns/${campaignId}/publish`}
              className={buttonVariants()}
            >
              Continue to Publish →
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {returnParam && (
              <p className="text-sm text-muted-foreground">
                Your bank account is being verified by Stripe. This may take a few minutes.
                You can proceed to publish once verification is complete.
              </p>
            )}
            {isAdmin ? (
              <form action={boundAction}>
                <button type="submit" className={buttonVariants()}>
                  Connect Bank Account →
                </button>
              </form>
            ) : (
              <p className="text-sm text-muted-foreground">
                Ask an admin to connect the bank account before you can publish.
              </p>
            )}
          </div>
        )}

        <div className="pt-2">
          <Link
            href={`/dashboard/orgs/${orgId}/campaigns/${campaignId}/pricing`}
            className={buttonVariants({ variant: "outline" })}
          >
            ← Back to Pricing
          </Link>
        </div>
      </div>
    </div>
  )
}
