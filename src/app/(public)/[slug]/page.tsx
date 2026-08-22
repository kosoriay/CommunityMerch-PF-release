import { notFound } from "next/navigation"
import { headers } from "next/headers"
import { getCampaignBySlug } from "@/lib/campaigns"
import { formatDate, daysUntil } from "@/lib/format"
import { getCatalog } from "@/lib/catalog-db"
import type { CatalogItem } from "@/lib/catalog-db"
import { CampaignCart } from "./_cart"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db/client"
import { orgMembers } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"
import { AdminBanner } from "./_admin-banner"
import { getOrCreateConfig } from "@/lib/platform-config"
import { getCampaignProgress, progressVisibility } from "@/lib/campaign-progress"
import { effectiveStatus } from "@/lib/campaign-lifecycle"
import { CampaignProgressPanel } from "@/components/campaign/progress-panel"

export const dynamic = "force-dynamic"

type Props = { params: Promise<{ slug: string }> }

export default async function PublicCampaignPage({ params }: Props) {
  const { slug } = await params
  const [campaign, platformCfg] = await Promise.all([
    getCampaignBySlug(slug),
    getOrCreateConfig(),
  ])

  if (!campaign) notFound()

  const progress = (await getCampaignProgress(campaign.id))!

  const catalogItems = await getCatalog()
  const catalogMap: Record<string, CatalogItem> = Object.fromEntries(
    catalogItems.map((item) => [item.id, item])
  )

  if (campaign.org?.closedAt) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Campaign Closed</h1>
          <p className="text-muted-foreground">
            {campaign.org.name} is no longer running campaigns.
          </p>
        </div>
      </div>
    )
  }

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
  // A passed deadline and an organiser pressing "End campaign" are the same
  // thing to a buyer: it can no longer be bought.
  const isEnded = effectiveStatus(campaign, new Date()) === "closed"

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

        {/* Progress — real order data. A buyer must never be shown a bar that
            does not correspond to what has actually sold. */}
        {(daysLeft !== null || campaign.goalAmount || progress.orderCount > 0 || isEnded) && (
          <div className="space-y-2">
            <CampaignProgressPanel
              netRaisedCents={progress.netRaisedCents}
              goalCents={progress.goalCents}
              percentOfGoal={progress.percentOfGoal}
              itemsSold={progress.itemsSold}
              supporterCount={progress.supporterCount}
              daysRemaining={progress.daysRemaining}
              visibility={progressVisibility("public", campaign.amountDisplayMode)}
            />
            {daysLeft !== null && !isEnded && (
              <p className="text-xs text-muted-foreground text-center">
                Deadline {formatDate(campaign.deadline!)}
              </p>
            )}
            {isEnded && (
              <p className="text-sm text-red-600 font-medium text-center">Campaign ended</p>
            )}
          </div>
        )}

        {/* Cart + Products */}
        {isEnded ? (
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
              mockupUrls: (() => {
                if (!p.mockupUrls) return null
                try {
                  const parsed: unknown = JSON.parse(p.mockupUrls)
                  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null
                  // 壊れた1行で公開ページを 500 にしない。
                  return Object.fromEntries(
                    Object.entries(parsed).filter(([, v]) => typeof v === "string")
                  ) as Record<string, string>
                } catch {
                  return null
                }
              })(),
              availableColors: (() => {
                // ここで既定色を捏造しない。かつての既定は17商品中7商品で誤りであり、
                // うち2つは Printful にその色の variant が存在しなかった（設計 §3.2）。
                // 空にしておけば colorsFor が空を返し、カートはその商品カードだけを
                // 購入不可として描画する（設計 §7.6）。キャンペーンは止まらない。
                try {
                  const parsed: unknown = JSON.parse(p.availableColors ?? "[]")
                  return Array.isArray(parsed) ? (parsed as string[]) : []
                } catch {
                  return []
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
