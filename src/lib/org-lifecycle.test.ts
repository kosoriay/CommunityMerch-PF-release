import { describe, it, expect, vi, beforeEach } from "vitest"

const findCampaigns = vi.fn()
const findOrg = vi.fn()
const selectCount = vi.fn()

vi.mock("@/lib/db/client", () => ({
  db: {
    query: {
      campaigns: { findMany: (...a: unknown[]) => findCampaigns(...a) },
      organizations: { findFirst: (...a: unknown[]) => findOrg(...a) },
    },
    select: () => ({ from: () => ({ where: () => selectCount() }) }),
  },
}))

const balanceRetrieve = vi.fn()
vi.mock("@/lib/providers/stripe", () => ({
  stripe: { balance: { retrieve: (...a: unknown[]) => balanceRetrieve(...a) } },
}))
vi.mock("@/lib/providers/r2", () => ({
  r2KeyFromUrl: () => null,
  deleteFromR2: async () => ({ deleted: 0, failed: 0 }),
}))

import {
  confirmationMatches,
  isOrgClosed,
  getDeletionBlockers,
  describeBlocker,
} from "@/lib/org-lifecycle"

beforeEach(() => {
  findCampaigns.mockReset()
  findOrg.mockReset()
  selectCount.mockReset()
  balanceRetrieve.mockReset()
  // Default: one draft campaign, no orders, no Stripe account — deletable.
  findCampaigns.mockImplementation(async (args?: { where?: unknown }) => {
    // Second call filters for active campaigns; return none by default.
    return findCampaigns.mock.calls.length === 1 ? [{ id: "c1" }] : []
  })
  selectCount.mockResolvedValue([{ n: 0 }])
  findOrg.mockResolvedValue({ id: "org-1", name: "Test Org", stripeAccountId: null })
})

describe("getDeletionBlockers", () => {
  it("should allow deletion when nothing is outstanding", async () => {
    expect(await getDeletionBlockers("org-1")).toEqual([])
  })

  it("should block when any order exists, including an abandoned checkout", async () => {
    // A pending order means a Stripe session may still be open — paying after
    // deletion would capture money against a campaign that no longer exists.
    selectCount.mockResolvedValue([{ n: 1 }])

    const blockers = await getDeletionBlockers("org-1")

    expect(blockers).toContainEqual({ kind: "orders", count: 1 })
  })

  it("should block while a campaign is still live", async () => {
    findCampaigns.mockImplementation(async () =>
      findCampaigns.mock.calls.length === 1 ? [{ id: "c1" }] : [{ id: "c1" }]
    )

    const blockers = await getDeletionBlockers("org-1")

    expect(blockers).toContainEqual({ kind: "active_campaigns", count: 1 })
  })

  it("should block when money remains in the payout account", async () => {
    // The organization has no Stripe dashboard, so deleting would strand it.
    findOrg.mockResolvedValue({ id: "org-1", name: "Test Org", stripeAccountId: "acct_1" })
    balanceRetrieve.mockResolvedValue({ available: [{ amount: 1059 }], pending: [] })

    const blockers = await getDeletionBlockers("org-1")

    expect(blockers).toContainEqual({ kind: "stripe_balance", amountCents: 1059 })
  })

  it("should count pending balance as well as available", async () => {
    findOrg.mockResolvedValue({ id: "org-1", name: "Test Org", stripeAccountId: "acct_1" })
    balanceRetrieve.mockResolvedValue({ available: [{ amount: 500 }], pending: [{ amount: 700 }] })

    const blockers = await getDeletionBlockers("org-1")

    expect(blockers).toContainEqual({ kind: "stripe_balance", amountCents: 1200 })
  })

  it("should allow deletion when the payout account is empty", async () => {
    findOrg.mockResolvedValue({ id: "org-1", name: "Test Org", stripeAccountId: "acct_1" })
    balanceRetrieve.mockResolvedValue({ available: [{ amount: 0 }], pending: [] })

    expect(await getDeletionBlockers("org-1")).toEqual([])
  })

  it("should refuse deletion when Stripe cannot be reached", async () => {
    // An unknown balance must never be treated as an all-clear.
    findOrg.mockResolvedValue({ id: "org-1", name: "Test Org", stripeAccountId: "acct_1" })
    balanceRetrieve.mockRejectedValue(new Error("Stripe unavailable"))

    const blockers = await getDeletionBlockers("org-1")

    expect(blockers).toContainEqual({ kind: "stripe_unreachable" })
  })

  it("should treat an account Stripe no longer has as empty rather than unknown", async () => {
    findOrg.mockResolvedValue({ id: "org-1", name: "Test Org", stripeAccountId: "acct_gone" })
    balanceRetrieve.mockRejectedValue(Object.assign(new Error("No such account"), { statusCode: 404 }))

    expect(await getDeletionBlockers("org-1")).toEqual([])
  })

  it("should report every blocker at once rather than one at a time", async () => {
    selectCount.mockResolvedValue([{ n: 2 }])
    findCampaigns.mockImplementation(async () => [{ id: "c1" }])
    findOrg.mockResolvedValue({ id: "org-1", name: "Test Org", stripeAccountId: "acct_1" })
    balanceRetrieve.mockResolvedValue({ available: [{ amount: 900 }], pending: [] })

    const blockers = await getDeletionBlockers("org-1")

    expect(blockers).toHaveLength(3)
  })
})

describe("describeBlocker", () => {
  it("should point an organization with orders at closing instead", () => {
    expect(describeBlocker({ kind: "orders", count: 3 }, "Lincoln PTA")).toContain("close the organization")
  })

  it("should show the stranded amount in dollars", () => {
    expect(describeBlocker({ kind: "stripe_balance", amountCents: 1059 }, "Lincoln PTA")).toContain("$10.59")
  })

  it("should say an unknown balance is why deletion is blocked", () => {
    expect(describeBlocker({ kind: "stripe_unreachable" }, "Lincoln PTA")).toContain("could not confirm")
  })
})

describe("confirmationMatches", () => {
  it("should accept the exact organization name", () => {
    expect(confirmationMatches("Lincoln Elementary PTA", "Lincoln Elementary PTA")).toBe(true)
  })

  it("should tolerate surrounding whitespace from a paste", () => {
    expect(confirmationMatches("  Lincoln Elementary PTA  ", "Lincoln Elementary PTA")).toBe(true)
  })

  it("should reject a near miss", () => {
    expect(confirmationMatches("Lincoln Elementary", "Lincoln Elementary PTA")).toBe(false)
  })

  it("should be case sensitive, so the name is genuinely read rather than guessed", () => {
    expect(confirmationMatches("lincoln elementary pta", "Lincoln Elementary PTA")).toBe(false)
  })

  it("should reject an empty confirmation", () => {
    expect(confirmationMatches("", "Lincoln Elementary PTA")).toBe(false)
    expect(confirmationMatches(null, "Lincoln Elementary PTA")).toBe(false)
  })
})

describe("isOrgClosed", () => {
  it("should treat an organization with a closure date as closed", () => {
    expect(isOrgClosed({ closedAt: new Date() })).toBe(true)
  })

  it("should treat an organization without one as open", () => {
    expect(isOrgClosed({ closedAt: null })).toBe(false)
  })
})
