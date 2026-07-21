"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { createOrg, validateOrgName } from "@/lib/orgs"
import { validateUserName, updateUserName } from "@/lib/users"
import { createCampaign, savePricingStep, type ProductInput } from "@/lib/campaigns"
import { getCatalogItem } from "@/lib/catalog-db"
import { requireOrgAccess } from "@/lib/middleware/require-org-access"

export type OnboardingState = { error?: string } | undefined

type ParsedDraftProduct = { variantId: string; retailDollars: string; colors: string[] }

/** Defensively narrow one element of the client-supplied `draftProducts` JSON. */
function parseDraftProduct(dp: unknown): ParsedDraftProduct | null {
  if (!dp || typeof dp !== "object") return null
  const obj = dp as Record<string, unknown>
  if (typeof obj.variantId !== "string") return null
  const retailDollars = typeof obj.retailDollars === "string" ? obj.retailDollars : ""
  const colors = Array.isArray(obj.colors)
    ? obj.colors.filter((c): c is string => typeof c === "string")
    : []
  return { variantId: obj.variantId, retailDollars, colors }
}

type OrgResolution = { kind: "reuse"; orgId: string } | { kind: "create"; name: string }

export async function completeOnboardingAction(
  _prevState: OnboardingState,
  formData: FormData
): Promise<OnboardingState> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/sign-in")

  // Validate everything before performing any write.
  const nameResult = validateUserName(formData.get("displayName") as string | null)
  if ("error" in nameResult) return { error: nameResult.error }

  const chosenOrgId = (formData.get("orgId") as string | null)?.trim() || null
  let orgResolution: OrgResolution
  if (chosenOrgId) {
    try {
      await requireOrgAccess(session.user.id, chosenOrgId, "member")
    } catch {
      return { error: "Organization not found." }
    }
    orgResolution = { kind: "reuse", orgId: chosenOrgId }
  } else {
    const orgResult = validateOrgName(formData.get("orgName") as string | null)
    if ("error" in orgResult) return { error: orgResult.error }
    orgResolution = { kind: "create", name: orgResult.value }
  }

  // All validation passed — now perform writes.
  if (nameResult.value !== session.user.name) {
    await updateUserName(session.user.id, nameResult.value)
  }

  const orgId = orgResolution.kind === "reuse"
    ? orgResolution.orgId
    : (await createOrg(orgResolution.name, session.user.id)).id

  // Campaign name + replayed products from the preview draft (may be absent).
  const rawName = ((formData.get("campaignName") as string | null) ?? "").trim()
  const campaignName = rawName.length >= 2 ? rawName.slice(0, 100) : "My Campaign"
  const campaign = await createCampaign(orgId, campaignName)

  const draftRaw = formData.get("draftProducts") as string | null
  if (draftRaw) {
    let rawProducts: unknown[] = []
    try {
      const parsed: unknown = JSON.parse(draftRaw)
      rawProducts = Array.isArray(parsed) ? parsed : []
    } catch { rawProducts = [] }
    const productList: ProductInput[] = []
    for (let i = 0; i < rawProducts.length && i < 5; i++) {
      const dp = parseDraftProduct(rawProducts[i])
      if (!dp) continue
      const item = await getCatalogItem(dp.variantId)
      if (!item) continue
      const retail = Math.round(parseFloat(dp.retailDollars || "0") * 100)
      if (!Number.isFinite(retail) || retail < 100) continue
      productList.push({
        printfulVariantId: dp.variantId,
        retailPrice: retail,
        podCost: item.podCostCents,
        displayOrder: i,
        availableColors: dp.colors.length > 0 ? dp.colors : ["White"],
      })
    }
    if (productList.length > 0) {
      const goalStr = (formData.get("goalDollars") as string | null) ?? ""
      const goal = goalStr && parseFloat(goalStr) > 0 ? Math.round(parseFloat(goalStr) * 100) : null
      const deadlineStr = (formData.get("deadline") as string | null) ?? ""
      const deadline = deadlineStr ? new Date(deadlineStr) : null
      await savePricingStep(
        campaign.id, productList, goal,
        deadline && deadline > new Date() ? deadline : null,
        "percent_only"
      )
    }
  }

  redirect(`/dashboard/orgs/${orgId}/campaigns/${campaign.id}/design`)
}
