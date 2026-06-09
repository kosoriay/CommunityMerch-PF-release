import { vi } from "vitest"
import { describe, it, expect } from "vitest"

vi.mock("@/lib/db/client", () => ({ db: {} }))

import { generateCampaignSlug } from "./campaigns"

describe("generateCampaignSlug", () => {
  it("combines title slug with year", () => {
    const result = generateCampaignSlug("Lincoln Elementary PTA", 2026)
    expect(result).toBe("lincoln-elementary-pta-2026")
  })

  it("strips special characters", () => {
    const result = generateCampaignSlug("St. Mary's Spring!", 2026)
    expect(result).toBe("st-marys-spring-2026")
  })

  it("truncates long titles", () => {
    const result = generateCampaignSlug("A".repeat(60), 2026)
    expect(result.length).toBeLessThanOrEqual(50)
  })

  it("never produces a reserved slug", () => {
    const result = generateCampaignSlug("Dashboard", 2026)
    expect(result).not.toBe("dashboard-2026")
  })
})
