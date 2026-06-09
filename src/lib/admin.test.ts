import { describe, it, expect, vi } from "vitest"

// Mock the DB client so the module can load without real env vars
vi.mock("@/lib/db/client", () => ({ db: {} }))

import { formatRevenueDollars } from "./admin"

describe("formatRevenueDollars", () => {
  it("converts cents to dollars string", () => {
    expect(formatRevenueDollars(432000)).toBe("$4,320.00")
  })

  it("handles zero", () => {
    expect(formatRevenueDollars(0)).toBe("$0.00")
  })

  it("handles large amounts", () => {
    expect(formatRevenueDollars(1000000)).toBe("$10,000.00")
  })
})
