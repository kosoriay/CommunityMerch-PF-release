import { describe, it, expect, vi } from "vitest"

// Mock the DB client so the module can load without real env vars
vi.mock("@/lib/db/client", () => ({ db: {} }))

import { validateUserName } from "./users"

describe("validateUserName", () => {
  it("should trim surrounding whitespace and return the value when valid", () => {
    expect(validateUserName("  Alex Kim  ")).toEqual({ value: "Alex Kim" })
  })

  it("should reject an empty name", () => {
    expect(validateUserName("")).toEqual({ error: "Name is required." })
  })

  it("should reject a whitespace-only name", () => {
    expect(validateUserName("   ")).toEqual({ error: "Name is required." })
  })

  it("should reject a null name", () => {
    expect(validateUserName(null)).toEqual({ error: "Name is required." })
  })

  it("should reject a name longer than 80 characters", () => {
    expect(validateUserName("A".repeat(81))).toEqual({
      error: "Name must be 80 characters or fewer.",
    })
  })

  it("should accept a name exactly 80 characters", () => {
    const name = "A".repeat(80)
    expect(validateUserName(name)).toEqual({ value: name })
  })
})
