import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { auth } from "@/lib/auth"
import { requireOrgAccess } from "@/lib/middleware/require-org-access"
import { getCampaign } from "@/lib/campaigns"
import { DesignForm } from "./_form"
import { saveDesignAction } from "./_actions"

type Props = { params: Promise<{ orgId: string; campaignId: string }> }

export default async function DesignPage({ params }: Props) {
  const { orgId, campaignId } = await params
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) notFound()

  try {
    await requireOrgAccess(session.user.id, orgId, "member")
  } catch {
    notFound()
  }

  const campaign = await getCampaign(campaignId)
  if (!campaign || campaign.orgId !== orgId) notFound()

  const boundAction = saveDesignAction.bind(null, orgId, campaignId)

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
          <span>Step 1 of 4</span>
          <span>·</span>
          <span className="font-medium text-foreground">Design</span>
        </div>
        <h1 className="text-2xl font-semibold text-[#2E4057]">{campaign.title}</h1>
      </div>

      <div className="rounded-lg border bg-white p-6">
        <DesignForm
          orgId={orgId}
          campaignId={campaignId}
          existingUrl={campaign.design?.designFileUrl ?? null}
          existingMockupUrl={campaign.design?.mockupUrl ?? null}
          action={boundAction}
        />
      </div>
    </div>
  )
}
