import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { auth } from "@/lib/auth"
import { requireOrgAccess } from "@/lib/middleware/require-org-access"
import { getOrg, getOrgMembers } from "@/lib/orgs"
import { getPayoutStatus, PAYOUT_STATUS_LABEL, PAYOUT_STATUS_TEXT_CLASS } from "@/lib/payouts"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import Link from "next/link"

type Props = { params: Promise<{ orgId: string }> }

export default async function OrgPage({ params }: Props) {
  const { orgId } = await params
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) notFound()

  let membership
  try {
    membership = await requireOrgAccess(session.user.id, orgId, "buyer")
  } catch {
    notFound()
  }

  const [org, members] = await Promise.all([getOrg(orgId), getOrgMembers(orgId)])
  if (!org) notFound()

  const isAdmin = membership.role === "admin"
  const payoutStatus = getPayoutStatus(org)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#2E4057]">{org.name}</h1>
          <p className="text-muted-foreground text-sm">/{org.slug}</p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Link
              href={`/dashboard/orgs/${orgId}/settings`}
              className={buttonVariants({ variant: "outline" })}
            >
              Settings
            </Link>
            <Link href={`/dashboard/orgs/${orgId}/members`} className={buttonVariants()}>
              Manage Members
            </Link>
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border bg-white p-4">
          <p className="text-sm text-muted-foreground">Members</p>
          <p className="text-3xl font-semibold mt-1">{members.length}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-sm text-muted-foreground">Your role</p>
          <p className="text-3xl font-semibold mt-1 capitalize">{membership.role}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-sm text-muted-foreground">Payouts</p>
          <p className={`text-lg font-semibold mt-1 ${PAYOUT_STATUS_TEXT_CLASS[payoutStatus]}`}>
            {PAYOUT_STATUS_LABEL[payoutStatus]}
          </p>
          {isAdmin && (
            <Link
              href={`/dashboard/orgs/${orgId}/settings/payouts`}
              className={cn(
                buttonVariants({
                  variant: payoutStatus === "ready" ? "outline" : "default",
                  size: "sm",
                }),
                "mt-3",
                // the default outline border is invisible on the white card
                payoutStatus === "ready" && "border-slate-400 bg-slate-50 hover:bg-slate-100"
              )}
            >
              {payoutStatus === "ready" ? "Manage payouts" : "Set up payouts →"}
            </Link>
          )}
        </div>
      </div>

      <div className="rounded-lg border bg-white p-4 flex items-center justify-between">
        <p className="text-muted-foreground text-sm">No campaigns yet.</p>
        <Link
          href={`/dashboard/orgs/${orgId}/campaigns/new`}
          className={buttonVariants()}
        >
          New Campaign
        </Link>
      </div>
    </div>
  )
}
