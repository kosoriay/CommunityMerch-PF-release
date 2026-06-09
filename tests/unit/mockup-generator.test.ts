import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/db/client", () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
}))
vi.mock("@/lib/providers/printful-mockup", () => ({
  generateMockup: vi.fn(),
}))
vi.mock("server-only", () => ({}))

import { db } from "@/lib/db/client"
import { generateMockup } from "@/lib/providers/printful-mockup"
import { generateCampaignMockups } from "@/lib/mockup-generator"

function makeSelector(result: unknown[]) {
  const builder = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(result),
  }
  return builder
}

function makeUpdater() {
  const builder = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(undefined),
  }
  return builder
}

describe("generateCampaignMockups", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("skips when campaign has no design", async () => {
    vi.mocked(db.select).mockReturnValueOnce(makeSelector([]) as never)

    await generateCampaignMockups("campaign-1")

    expect(generateMockup).not.toHaveBeenCalled()
  })

  it("skips when design has no designFileUrl", async () => {
    vi.mocked(db.select).mockReturnValueOnce(
      makeSelector([{ id: "d1", campaignId: "campaign-1", designFileUrl: null }]) as never
    )

    await generateCampaignMockups("campaign-1")

    expect(generateMockup).not.toHaveBeenCalled()
  })

  it("generates mockups for each product and stores URLs", async () => {
    const design = { id: "d1", campaignId: "c1", designFileUrl: "https://example.com/design.png" }
    const product = { id: "p1", campaignId: "c1", printfulVariantId: "bc-3001-tee" }
    const catalogEntry = { id: "bc-3001-tee", printfulProductId: 71, defaultMockupVariantId: 4012 }
    const mockupUrl = "https://cdn.printful.com/mockup.jpg"

    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelector([design]) as never)
      .mockReturnValueOnce(makeSelector([product]) as never)
      .mockReturnValueOnce(makeSelector([catalogEntry]) as never)
    vi.mocked(db.update).mockReturnValueOnce(makeUpdater() as never)
    vi.mocked(generateMockup).mockResolvedValue(mockupUrl)

    await generateCampaignMockups("c1")

    expect(generateMockup).toHaveBeenCalledWith("https://example.com/design.png", 71, 4012)
    expect(db.update).toHaveBeenCalledTimes(1)
  })

  it("continues processing remaining products when one throws", async () => {
    const design = { id: "d1", campaignId: "c1", designFileUrl: "https://example.com/design.png" }
    const products = [
      { id: "p1", campaignId: "c1", printfulVariantId: "bc-3001-tee" },
      { id: "p2", campaignId: "c1", printfulVariantId: "gildan-5000-classic" },
    ]
    const catalog1 = { id: "bc-3001-tee", printfulProductId: 71, defaultMockupVariantId: 4012 }
    const catalog2 = { id: "gildan-5000-classic", printfulProductId: 438, defaultMockupVariantId: 11577 }

    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelector([design]) as never)
      .mockReturnValueOnce(makeSelector(products) as never)
      .mockReturnValueOnce(makeSelector([catalog1]) as never)
      .mockReturnValueOnce(makeSelector([catalog2]) as never)
    vi.mocked(db.update).mockReturnValueOnce(makeUpdater() as never)
    vi.mocked(generateMockup)
      .mockRejectedValueOnce(new Error("API error"))
      .mockResolvedValueOnce("https://cdn.printful.com/gildan.jpg")

    await generateCampaignMockups("c1")

    expect(generateMockup).toHaveBeenCalledTimes(2)
    expect(db.update).toHaveBeenCalledTimes(1)
  })

  it("skips products with no defaultMockupVariantId in catalog", async () => {
    const design = { id: "d1", campaignId: "c1", designFileUrl: "https://example.com/design.png" }
    const product = { id: "p1", campaignId: "c1", printfulVariantId: "bc-3001-tee" }
    const catalogEntry = { id: "bc-3001-tee", printfulProductId: 71, defaultMockupVariantId: null }

    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelector([design]) as never)
      .mockReturnValueOnce(makeSelector([product]) as never)
      .mockReturnValueOnce(makeSelector([catalogEntry]) as never)

    await generateCampaignMockups("c1")

    expect(generateMockup).not.toHaveBeenCalled()
  })
})
