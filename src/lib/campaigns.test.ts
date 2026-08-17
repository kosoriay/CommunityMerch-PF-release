import { vi } from "vitest"
import { describe, it, expect } from "vitest"

vi.mock("@/lib/db/client", () => ({ db: {} }))

// Stands in for the real bucket: anything under this prefix is ours, and the
// key is whatever follows it.
vi.mock("@/lib/providers/r2", () => ({
  r2KeyFromUrl: (url: string | null | undefined) => {
    const base = "https://cdn.example.com"
    if (!url || !url.startsWith(`${base}/`)) return null
    const key = url.slice(base.length + 1)
    return key.length > 0 ? key : null
  },
  deleteFromR2: async () => ({ deleted: 0, failed: 0 }),
}))

import { generateCampaignSlug, supersededDesignKey } from "./campaigns"

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

const OLD = "https://cdn.example.com/uploads/old.png"
const NEW = "https://cdn.example.com/uploads/new.png"

describe("supersededDesignKey", () => {
  it("should return the old key when the design is replaced", () => {
    expect(supersededDesignKey(OLD, NEW)).toBe("uploads/old.png")
  })

  it("should return the old key when the design is removed", () => {
    expect(supersededDesignKey(OLD, null)).toBe("uploads/old.png")
  })

  it("should return null when the design is unchanged", () => {
    // The design form resubmits the same hidden URL on every save. Deleting
    // here would destroy the design the campaign is currently showing.
    expect(supersededDesignKey(OLD, OLD)).toBeNull()
  })

  it("should return null when there was no previous design", () => {
    expect(supersededDesignKey(null, NEW)).toBeNull()
  })

  it("should return null when the previous design is not in our bucket", () => {
    // Dev writes to public/uploads/ instead of R2. A delete built from that
    // path would be aimed at a key we do not own.
    expect(supersededDesignKey("/uploads/local.png", NEW)).toBeNull()
  })

  it("should return null when both are absent", () => {
    expect(supersededDesignKey(null, null)).toBeNull()
  })
})
