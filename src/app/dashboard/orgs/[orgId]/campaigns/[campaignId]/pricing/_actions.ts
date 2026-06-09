"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { requireOrgAccess } from "@/lib/middleware/require-org-access"
import { getCampaign, savePricingStep } from "@/lib/campaigns"
import { getCatalogItem } from "@/lib/catalog-db"

export async function savePricingAction(
  orgId: string,
  campaignId: string,
  _prevState: { error?: string } | undefined,
  formData: FormData
): Promise<{ error?: string }> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/sign-in")

  try {
    await requireOrgAccess(session.user.id, orgId, "member")
  } catch {
    return { error: "Access denied" }
  }

  const campaign = await getCampaign(campaignId)
  if (!campaign || campaign.orgId !== orgId) return { error: "Campaign not found" }

  const variantIds = formData.getAll("variantIds") as string[]
  if (variantIds.length === 0) return { error: "Select at least one product." }
  if (variantIds.length > 5) return { error: "Maximum 5 products per campaign." }

  const productList = []
  for (let i = 0; i < variantIds.length; i++) {
    const variantId = variantIds[i]
    const catalogItem = await getCatalogItem(variantId)
    if (!catalogItem) return { error: `Unknown product: ${variantId}` }

    const retailDollarsStr = formData.get(`retailPrice_${variantId}`) as string
    const retailDollars = parseFloat(retailDollarsStr)
    if (isNaN(retailDollars) || retailDollars < 1) {
      return { error: `Set a valid retail price for ${catalogItem.name}.` }
    }

    const colorsRaw = formData.getAll(`colors_${variantId}`) as string[]
    const availableColors = colorsRaw.length > 0 ? colorsRaw : ["White"]

    productList.push({
      printfulVariantId: variantId,
      retailPrice: Math.round(retailDollars * 100),
      podCost: catalogItem.podCostCents,
      displayOrder: i,
      availableColors,
    })
  }

  const goalDollarsStr = formData.get("goalAmount") as string
  const goalDollars = parseFloat(goalDollarsStr)
  const goalAmount = goalDollarsStr && !isNaN(goalDollars) && goalDollars > 0
    ? Math.round(goalDollars * 100)
    : null

  const deadlineStr = formData.get("deadline") as string
  const deadline = deadlineStr ? new Date(deadlineStr) : null
  if (deadline && deadline <= new Date()) return { error: "Deadline must be in the future." }

  const amountDisplayMode = formData.get("amountDisplayMode") === "show_amount"
    ? "show_amount" as const
    : "percent_only" as const

  await savePricingStep(campaignId, productList, goalAmount, deadline, amountDisplayMode)
  redirect(`/dashboard/orgs/${orgId}/campaigns/${campaignId}/connect-bank`)
}
