import { describe, it, expect, vi, beforeEach } from "vitest"

const getSession = vi.fn()
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: (...args: unknown[]) => getSession(...args) } },
}))
vi.mock("next/headers", () => ({ headers: async () => new Headers() }))
const redirect = vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`) })
vi.mock("next/navigation", () => ({ redirect: (url: string) => redirect(url) }))
vi.mock("@/lib/middleware/require-org-access", () => ({ requireOrgAccess: async () => undefined }))

const getCampaign = vi.fn()
const savePricingStep = vi.fn()
vi.mock("@/lib/campaigns", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/campaigns")>()),
  getCampaign: (...args: unknown[]) => getCampaign(...args),
  savePricingStep: (...args: unknown[]) => savePricingStep(...args),
}))
vi.mock("@/lib/db/client", () => ({ db: {} }))

const CATALOG: Record<string, { name: string; podCostCents: number; colors: string[] }> = {
  "bc-3001-tee": { name: "Classic Tee", podCostCents: 1225, colors: ["Black"] },
}
vi.mock("@/lib/catalog-db", () => ({
  getCatalogItem: async (id: string) => CATALOG[id],
}))
vi.mock("@/lib/cart-options", () => ({ defaultColorFor: () => "Black" }))

import { savePricingAction } from "./_actions"

function form(): FormData {
  const fd = new FormData()
  fd.append("variantIds", "bc-3001-tee")
  fd.set("retailPrice_bc-3001-tee", "29")
  fd.append("colors_bc-3001-tee", "Black")
  return fd
}

beforeEach(() => {
  getSession.mockReset().mockResolvedValue({ user: { id: "u1" } })
  getCampaign.mockReset().mockResolvedValue({
    orgId: "o1",
    products: [
      { id: "cp-tee", printfulVariantId: "bc-3001-tee" },
      { id: "cp-mug", printfulVariantId: "white-glossy-mug" }, // not in the catalog mock
    ],
  })
  savePricingStep.mockReset()
  redirect.mockClear()
})

describe("savePricingAction", () => {
  it("returns the blocked-removal message through the existing error state and does not redirect", async () => {
    savePricingStep.mockResolvedValue({ ok: false, blockedProductIds: ["cp-mug"] })

    const result = await savePricingAction("o1", "c1", undefined, form())

    expect(result.error).toBe(
      "white-glossy-mug has orders and can't be removed. Keep it selected, or close the campaign."
    )
    expect(redirect).not.toHaveBeenCalled()
  })

  it("names the product from the catalog when it is known", async () => {
    getCampaign.mockResolvedValue({
      orgId: "o1",
      products: [{ id: "cp-tee", printfulVariantId: "bc-3001-tee" }],
    })
    savePricingStep.mockResolvedValue({ ok: false, blockedProductIds: ["cp-tee"] })

    const result = await savePricingAction("o1", "c1", undefined, form())

    expect(result.error).toMatch(/^Classic Tee has orders/)
  })

  it("falls back to a generic subject when no blocked product can be named", async () => {
    savePricingStep.mockResolvedValue({ ok: false, blockedProductIds: [] })

    const result = await savePricingAction("o1", "c1", undefined, form())

    expect(result.error).toMatch(/^A product has orders/)
  })

  it("redirects to publish when the save succeeds", async () => {
    savePricingStep.mockResolvedValue({ ok: true })

    await expect(savePricingAction("o1", "c1", undefined, form())).rejects.toThrow(
      "REDIRECT:/dashboard/orgs/o1/campaigns/c1/publish"
    )
  })
})
