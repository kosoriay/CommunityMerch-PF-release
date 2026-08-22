import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { auth } from "@/lib/auth"
import { requireOrgAccess } from "@/lib/middleware/require-org-access"
import { getCampaign } from "@/lib/campaigns"
import { getCatalog } from "@/lib/catalog-db"
import { defaultColorFor } from "@/lib/cart-options"
import { PricingForm } from "./_form"
import { savePricingAction } from "./_actions"

type Props = { params: Promise<{ orgId: string; campaignId: string }> }

export default async function PricingPage({ params }: Props) {
  const { orgId, campaignId } = await params
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) notFound()

  try {
    await requireOrgAccess(session.user.id, orgId, "member")
  } catch {
    notFound()
  }

  const [campaign, catalog] = await Promise.all([
    getCampaign(campaignId),
    getCatalog(),
  ])
  if (!campaign || campaign.orgId !== orgId) notFound()

  const initialSelectedIds = campaign.products.map((p) => p.printfulVariantId)
  const initialPrices = Object.fromEntries(
    campaign.products.map((p) => [p.printfulVariantId, p.retailPrice])
  )
  // "White" は7商品で誤りになる（設計 §3.2）。カタログ行が引けない場合は
  // `[]`（`["White"]` を捏造しない）。
  const catalogById = new Map(catalog.map((c) => [c.id, c]))
  const initialColors = Object.fromEntries(
    campaign.products.map((p) => {
      const fallback = defaultColorFor(catalogById.get(p.printfulVariantId))
      const fallbackColors = fallback ? [fallback] : []
      try {
        const parsed = JSON.parse(p.availableColors) as unknown
        return [p.printfulVariantId, Array.isArray(parsed) ? (parsed as string[]) : fallbackColors]
      } catch {
        return [p.printfulVariantId, fallbackColors]
      }
    })
  )

  const boundAction = savePricingAction.bind(null, orgId, campaignId)

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
          <span>Step 2 of 3</span>
          <span>·</span>
          <span className="font-medium text-foreground">Products & Pricing</span>
        </div>
        <h1 className="text-2xl font-semibold text-[#2E4057]">{campaign.title}</h1>
      </div>

      <div className="rounded-lg border bg-white p-6">
        <PricingForm
          orgId={orgId}
          campaignId={campaignId}
          action={boundAction}
          initialSelectedIds={initialSelectedIds}
          initialPrices={initialPrices}
          initialGoal={campaign.goalAmount}
          initialDeadline={campaign.deadline}
          initialDisplayMode={campaign.amountDisplayMode}
          initialColors={initialColors}
          catalog={catalog}
        />
      </div>
    </div>
  )
}
