import { notFound } from "next/navigation"
import { headers } from "next/headers"
import { getCampaignBySlug } from "@/lib/campaigns"
import { formatCents, formatDate, daysUntil } from "@/lib/format"
import { getCatalog } from "@/lib/catalog-db"
import type { CatalogItem } from "@/lib/catalog-db"
import { CampaignCart } from "./_cart"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db/client"
import { orgMembers } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"
import { AdminBanner } from "./_admin-banner"
import { getOrCreateConfig } from "@/lib/platform-config"

export const dynamic = "force-dynamic"

type Props = { params: Promise<{ slug: string }> }

export default async function PublicCampaignPage({ params }: Props) {
  const { slug } = await params
  const [campaign, platformCfg] = await Promise.all([
    getCampaignBySlug(slug),
    getOrCreateConfig(),
  ])

  if (!campaign) notFound()

  const catalogItems = await getCatalog()
  const catalogMap: Record<string, CatalogItem> = Object.fromEntries(
    catalogItems.map((item) => [item.id, item])
  )

  if (campaign.org?.suspendedAt) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Campaign Unavailable</h1>
          <p className="text-muted-foreground">This campaign is temporarily unavailable. Please contact the organizer.</p>
        </div>
      </div>
    )
  }

  // Optional: detect if logged-in user is an admin of this org
  let adminDashboardUrl: string | null = null
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (session) {
      const membership = await db
        .select()
        .from(orgMembers)
        .where(
          and(
            eq(orgMembers.userId, session.user.id),
            eq(orgMembers.orgId, campaign.orgId)
          )
        )
        .limit(1)
      if (membership[0]?.role === "admin") {
        adminDashboardUrl = `/dashboard/orgs/${campaign.orgId}/campaigns/${campaign.id}/publish`
      }
    }
  } catch {
    // Not authenticated or error — public visitors don't need auth
  }

  const daysLeft = campaign.deadline ? daysUntil(campaign.deadline) : null
  const isExpired = daysLeft !== null && daysLeft <= 0

  return (
    <div>
      {adminDashboardUrl && <AdminBanner dashboardUrl={adminDashboardUrl} />}
      <div className="min-h-screen bg-[#F8FAFC]">
        <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-[#2E4057]">{campaign.title}</h1>
          <p className="text-muted-foreground text-sm">{campaign.org.name}</p>
        </div>

        {/* Design / Mockup */}
        {(campaign.design?.mockupUrl ?? campaign.design?.designFileUrl) && (
          <div className="flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={campaign.design.mockupUrl ?? campaign.design.designFileUrl!}
              alt={campaign.title}
              className="max-h-80 object-contain rounded-lg"
            />
          </div>
        )}

        {/* Stats */}
        {(daysLeft !== null || campaign.goalAmount) && (
          <div className="rounded-lg border bg-white p-4 space-y-2">
            {campaign.goalAmount && (
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Fundraising goal</span>
                  {campaign.amountDisplayMode === "show_amount" && (
                    <span className="font-medium">{formatCents(campaign.goalAmount)}</span>
                  )}
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-[#378ADD] rounded-full w-0" />
                </div>
              </div>
            )}
            {daysLeft !== null && (
              <p className="text-sm">
                {isExpired ? (
                  <span className="text-red-600 font-medium">Campaign ended</span>
                ) : (
                  <>
                    <span className="font-semibold text-[#2E4057]">{daysLeft} days</span>
                    <span className="text-muted-foreground">
                      {" "}left · Deadline {formatDate(campaign.deadline!)}
                    </span>
                  </>
                )}
              </p>
            )}
          </div>
        )}

        {/* Cart + Products */}
        {isExpired ? (
          <div className="rounded-lg border bg-white p-6 text-center text-muted-foreground">
            <p className="font-medium">Campaign ended</p>
            <p className="text-sm mt-1">Ordering is no longer available.</p>
          </div>
        ) : (
          <CampaignCart
            campaignId={campaign.id}
            orgId={campaign.org.id}
            catalog={catalogMap}
            products={campaign.products.map((p) => ({
              id: p.id,
              printfulVariantId: p.printfulVariantId,
              retailPrice: p.retailPrice,
              mockupUrl: p.mockupUrl ?? null,
              availableColors: (() => {
                try {
                  const parsed = JSON.parse(p.availableColors ?? '["White"]') as unknown
                  return Array.isArray(parsed) ? (parsed as string[]) : ["White"]
                } catch {
                  return ["White"]
                }
              })(),
            }))}
          />
        )}

          <p className="text-center text-xs text-muted-foreground">
            Powered by {platformCfg.platformName}
          </p>
        </div>
      </div>
    </div>
  )
}
