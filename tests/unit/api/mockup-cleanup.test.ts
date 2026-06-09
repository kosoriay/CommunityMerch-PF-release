import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/db/client", () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
}))
vi.mock("@/lib/mockup-generator", () => ({
  generateCampaignMockups: vi.fn(),
}))
vi.mock("server-only", () => ({}))

process.env.CRON_SECRET = "test-cron-secret"

import { db } from "@/lib/db/client"
import { generateCampaignMockups } from "@/lib/mockup-generator"
import { GET } from "@/app/api/cron/mockup-cleanup/route"

function makeSelector(result: unknown[]) {
  return {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(result),
  }
}

function makeUpdater() {
  return {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(undefined),
  }
}

describe("GET /api/cron/mockup-cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 401 when Authorization header is missing", async () => {
    const req = new Request("http://localhost/api/cron/mockup-cleanup")
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it("returns 401 when Authorization header has wrong secret", async () => {
    const req = new Request("http://localhost/api/cron/mockup-cleanup", {
      headers: { Authorization: "Bearer wrong-secret" },
    })
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it("returns 200 with correct secret and runs cleanup", async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelector([]) as never)
      .mockReturnValueOnce(makeSelector([]) as never)
      .mockReturnValueOnce(makeSelector([]) as never)

    const req = new Request("http://localhost/api/cron/mockup-cleanup", {
      headers: { Authorization: "Bearer test-cron-secret" },
    })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json() as { ok: boolean }
    expect(body.ok).toBe(true)
  })

  it("clears mockupUrl for closed-campaign products and calls regenerate for stale ones", async () => {
    const closedCampaign = { id: "camp-closed" }
    const staleCampaign = { id: "camp-stale" }

    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelector([closedCampaign]) as never)
      .mockReturnValueOnce(makeSelector([staleCampaign]) as never)
      .mockReturnValueOnce(makeSelector([]) as never)
    vi.mocked(db.update).mockReturnValueOnce(makeUpdater() as never)
    vi.mocked(generateCampaignMockups).mockResolvedValue(undefined)

    const req = new Request("http://localhost/api/cron/mockup-cleanup", {
      headers: { Authorization: "Bearer test-cron-secret" },
    })
    await GET(req)

    expect(db.update).toHaveBeenCalledTimes(1)
    expect(generateCampaignMockups).toHaveBeenCalledWith("camp-stale")
  })
})
