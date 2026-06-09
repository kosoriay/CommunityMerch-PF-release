import { describe, it, expect, vi } from "vitest"

// Mock the DB client so the module can load without real env vars
vi.mock("@/lib/db/client", () => ({ db: {} }))

import { generateSlug } from "./orgs"

describe("generateSlug", () => {
  it("lowercases and replaces spaces with hyphens", () => {
    expect(generateSlug("Lincoln Elementary PTA")).toBe("lincoln-elementary-pta")
  })

  it("strips special characters", () => {
    expect(generateSlug("St. Mary's School!")).toBe("st-marys-school")
  })

  it("collapses multiple spaces/hyphens", () => {
    expect(generateSlug("Team  A   Rockets")).toBe("team-a-rockets")
  })

  it("trims to 50 characters", () => {
    const long = generateSlug("A".repeat(60))
    expect(long.length).toBeLessThanOrEqual(50)
  })

  it("handles empty string", () => {
    expect(generateSlug("")).toBe("")
  })
})
