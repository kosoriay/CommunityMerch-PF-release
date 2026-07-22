import { describe, it, expect, vi } from "vitest"

// Mock the DB client so the module can load without real env vars
vi.mock("@/lib/db/client", () => ({ db: {} }))

import { buildStatTiles } from "./landing-stats"

describe("buildStatTiles", () => {
  it("returns no tiles when everything is zero", () => {
    expect(
      buildStatTiles({ totalRaisedCents: 0, campaignsLaunched: 0, organizations: 0 })
    ).toEqual([])
  })

  it("hides only the zero tiles", () => {
    const tiles = buildStatTiles({ totalRaisedCents: 432100, campaignsLaunched: 0, organizations: 3 })
    expect(tiles).toEqual([
      { value: "$4,321", label: "Raised by communities" },
      { value: "3", label: "Organizations fundraising" },
    ])
  })

  it("shows all three tiles when all are positive", () => {
    const tiles = buildStatTiles({ totalRaisedCents: 100, campaignsLaunched: 2, organizations: 1 })
    expect(tiles.map((t) => t.label)).toEqual([
      "Raised by communities",
      "Campaigns launched",
      "Organizations fundraising",
    ])
  })

  it("formats whole dollars with rounding", () => {
    const tiles = buildStatTiles({ totalRaisedCents: 123456, campaignsLaunched: 0, organizations: 0 })
    expect(tiles[0].value).toBe("$1,235")
  })
})
