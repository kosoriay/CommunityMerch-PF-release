import { describe, it, expect, vi } from "vitest"

// Mock the DB client so the module can load without real env vars
vi.mock("@/lib/db/client", () => ({ db: {} }))

import { generateSlug, validateOrgName } from "./orgs"

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

describe("validateOrgName", () => {
  it("should trim and accept a valid name", () => {
    expect(validateOrgName("  Lincoln PTA  ")).toEqual({ value: "Lincoln PTA" })
  })

  it("should reject a name shorter than 2 characters", () => {
    expect(validateOrgName("A")).toEqual({ error: "Name must be at least 2 characters." })
  })

  it("should reject a name longer than 80 characters", () => {
    expect(validateOrgName("A".repeat(81))).toEqual({
      error: "Name must be 80 characters or fewer.",
    })
  })

  it("should reject a name with no letters or numbers", () => {
    expect(validateOrgName("!!! ---")).toEqual({
      error: "Name must contain at least one letter or number.",
    })
  })
})
