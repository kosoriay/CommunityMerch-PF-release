import { describe, it, expect, vi } from "vitest"

// Mock the DB client so the module can load without real env vars
vi.mock("@/lib/db/client", () => ({ db: {} }))

import { buildStatTiles, STAT_TILE_MINIMUMS } from "./landing-stats"

describe("buildStatTiles", () => {
  it("returns no tiles when everything is zero", () => {
    expect(
      buildStatTiles({ totalRaisedCents: 0, campaignsLaunched: 0, organizations: 0 })
    ).toEqual([])
  })

  it("hides tiles below the social-proof minimums", () => {
    // Real early-days numbers: 1 campaign / 5 orgs / one shirt's worth raised
    expect(
      buildStatTiles({ totalRaisedCents: 3269, campaignsLaunched: 1, organizations: 5 })
    ).toEqual([])
  })

  it("shows only the tiles at or above their minimums", () => {
    const tiles = buildStatTiles({
      totalRaisedCents: 432100,
      campaignsLaunched: 2,
      organizations: STAT_TILE_MINIMUMS.organizations,
    })
    expect(tiles).toEqual([
      { value: "$4,321", label: "Raised by communities" },
      { value: "10", label: "Organizations fundraising" },
    ])
  })

  it("shows all three tiles when all reach their minimums", () => {
    const tiles = buildStatTiles({
      totalRaisedCents: STAT_TILE_MINIMUMS.raisedCents,
      campaignsLaunched: STAT_TILE_MINIMUMS.campaignsLaunched,
      organizations: 25,
    })
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
