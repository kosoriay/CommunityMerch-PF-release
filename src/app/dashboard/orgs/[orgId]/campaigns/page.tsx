import { headers } from "next/headers"
import { notFound } from "next/navigation"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { requireOrgAccess } from "@/lib/middleware/require-org-access"
import { getCampaignsByOrg } from "@/lib/campaigns"
import { buttonVariants } from "@/components/ui/button"
import { CampaignCard } from "@/components/campaign-card"

type Props = { params: Promise<{ orgId: string }> }

export default async function CampaignsPage({ params }: Props) {
  const { orgId } = await params
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) notFound()

  try {
    await requireOrgAccess(session.user.id, orgId, "member")
  } catch {
    notFound()
  }

  const allCampaigns = await getCampaignsByOrg(orgId)
  const active = allCampaigns.filter((c) => c.status === "active")
  const drafts = allCampaigns.filter((c) => c.status === "draft")
  const closed = allCampaigns.filter((c) => c.status === "closed")

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-[#2E4057]">Campaigns</h2>
        <Link
          href={`/dashboard/orgs/${orgId}/campaigns/new`}
          className={buttonVariants()}
        >
          New Campaign
        </Link>
      </div>

      {allCampaigns.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="mb-4">No campaigns yet.</p>
          <Link
            href={`/dashboard/orgs/${orgId}/campaigns/new`}
            className={buttonVariants()}
          >
            Create your first campaign
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {active.length > 0 && (
            <section>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">Active</h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {active.map((c) => (
                  <CampaignCard key={c.id} campaign={c} />
                ))}
              </div>
            </section>
          )}
          {drafts.length > 0 && (
            <section>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">Drafts</h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {drafts.map((c) => (
                  <CampaignCard key={c.id} campaign={c} />
                ))}
              </div>
            </section>
          )}
          {closed.length > 0 && (
            <section>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">Closed</h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {closed.map((c) => (
                  <CampaignCard key={c.id} campaign={c} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
