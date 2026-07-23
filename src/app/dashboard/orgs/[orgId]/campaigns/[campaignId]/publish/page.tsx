import { headers } from "next/headers"
import { notFound } from "next/navigation"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { requireOrgAccess } from "@/lib/middleware/require-org-access"
import { getCampaign } from "@/lib/campaigns"
import { publishCampaignAction } from "./_actions"
import { buttonVariants } from "@/components/ui/button"
import { formatCents, formatDate } from "@/lib/format"
import { getCatalogItem } from "@/lib/catalog-db"

type Props = {
  params: Promise<{ orgId: string; campaignId: string }>
  searchParams: Promise<{ error?: string; published?: string }>
}

const ERROR_MESSAGES: Record<string, string> = {
  forbidden: "Only admins can publish campaigns.",
  "not-found": "Campaign not found.",
  "no-products": "Add at least one product before publishing.",
  "no-design": "Upload a design before going live — it's what gets printed on your merchandise.",
}

export default async function PublishPage({ params, searchParams }: Props) {
  const { orgId, campaignId } = await params
  const { error: errorKey, published } = await searchParams
  const errorMessage = errorKey ? ERROR_MESSAGES[errorKey] : undefined
  const justPublished = published === "1"
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

  const isAlreadyLive = campaign.status === "active"

  const productDetails = await Promise.all(
    campaign.products.map((p) => getCatalogItem(p.printfulVariantId))
  )
  const catalogMap = Object.fromEntries(
    campaign.products.map((p, i) => [p.printfulVariantId, productDetails[i]])
  )

  const isAdmin = membership.role === "admin"
  const appUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3000"
  const publicUrl = `${appUrl}/${campaign.slug}`
  const boundAction = publishCampaignAction.bind(null, orgId, campaignId)

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
          <span>Step 3 of 3</span>
          <span>·</span>
          <span className="font-medium text-foreground">Publish</span>
        </div>
        <h1 className="text-2xl font-semibold text-[#2E4057]">{campaign.title}</h1>
      </div>

      <div className="space-y-4">
        {/* Campaign summary */}
        <div className="rounded-lg border bg-white p-6 space-y-4">
          <h2 className="font-semibold">Campaign summary</h2>

          {campaign.design?.designFileUrl ? (
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={campaign.design.designFileUrl}
                alt="Design"
                className="h-16 w-16 object-contain border rounded"
              />
              <p className="text-sm text-green-700 font-medium">Design uploaded ✓</p>
            </div>
          ) : (
            <p className="text-sm text-red-600">
              ⚠ No design uploaded — a design is required before going live.{" "}
              <Link
                href={`/dashboard/orgs/${orgId}/campaigns/${campaignId}/design`}
                className="underline"
              >
                Upload a design.
              </Link>
            </p>
          )}

          <div>
            <h3 className="text-sm font-medium mb-2">Products</h3>
            {campaign.products.length === 0 ? (
              <p className="text-sm text-red-600">
                No products selected.{" "}
                <Link href={`/dashboard/orgs/${orgId}/campaigns/${campaignId}/pricing`} className="underline">
                  Go back to add products.
                </Link>
              </p>
            ) : (
              <ul className="space-y-1">
                {campaign.products.map((p) => {
                  const catalogItem = catalogMap[p.printfulVariantId]
                  return (
                    <li key={p.id} className="text-sm flex justify-between">
                      <span>{catalogItem?.name ?? p.printfulVariantId}</span>
                      <span className="font-medium">{formatCents(p.retailPrice)}</span>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {campaign.goalAmount && (
            <p className="text-sm">
              Goal: <span className="font-medium">{formatCents(campaign.goalAmount)}</span>
            </p>
          )}
          {campaign.deadline && (
            <p className="text-sm">
              Deadline: <span className="font-medium">{formatDate(campaign.deadline)}</span>
            </p>
          )}
        </div>

        {/* Public URL */}
        <div className="rounded-lg border bg-white p-6 space-y-3">
          <h2 className="font-semibold">Shareable link</h2>
          <div className="bg-slate-50 rounded p-3 font-mono text-sm break-all">
            {publicUrl}
          </div>
          <p className="text-sm text-muted-foreground">
            Share this link with your community to collect orders.
          </p>
        </div>

        {/* Actions */}
        {isAlreadyLive ? (
          <div className="rounded-lg border bg-green-50 border-green-200 p-6 space-y-3">
            {justPublished ? (
              <h2 className="font-semibold text-green-800">🎉 Your campaign is live!</h2>
            ) : (
              <h2 className="font-semibold text-green-800">✅ Campaign is live</h2>
            )}
            <p className="text-sm text-green-700">
              Share the link below with your community to start collecting orders.
            </p>
            <div className="flex gap-3 flex-wrap pt-1">
              <a
                href={publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants()}
              >
                View Campaign →
              </a>
              <Link
                href={`/dashboard/orgs/${orgId}/campaigns`}
                className={buttonVariants({ variant: "outline" })}
              >
                ← Back to Campaigns
              </Link>
            </div>
          </div>
        ) : (
          <div className="flex gap-3 flex-wrap">
            {errorMessage && (
              <p className="w-full text-sm text-red-600 rounded-lg border border-red-200 bg-red-50 p-3">
                {errorMessage}
              </p>
            )}
            {isAdmin ? (
              <form action={boundAction}>
                <button
                  type="submit"
                  className={buttonVariants()}
                  disabled={campaign.products.length === 0 || !campaign.design?.designFileUrl}
                >
                  🚀 Go Live
                </button>
              </form>
            ) : (
              <p className="text-sm text-muted-foreground py-2">
                Only admins can publish campaigns.
              </p>
            )}
            {isAdmin && (
              <Link
                href={`/dashboard/orgs/${orgId}/settings/payouts`}
                className={buttonVariants({ variant: "outline" })}
              >
                Payout Settings
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
