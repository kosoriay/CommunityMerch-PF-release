import { describe, it, expect, vi } from "vitest"

vi.mock("@/lib/db/client", () => ({ db: {} }))

import {
  percentOfGoal,
  barWidthPercent,
  daysRemaining,
  summariseOrders,
  progressVisibility,
} from "@/lib/campaign-progress"

// One tee: $28.00 retail, $12.25 POD, 9% fee → $32.69 charged, org nets $10.59.
// These are the figures measured against a live Stripe transfer.
const order = (over: Partial<{ status: string; buyerEmail: string | null; quantity: number }> = {}) => ({
  status: over.status ?? "delivered",
  buyerEmail: over.buyerEmail === undefined ? "buyer@example.com" : over.buyerEmail,
  totalAmountCents: 2800,
  campaign: { platformFeeRate: 900 },
  items: [{ quantity: over.quantity ?? 1, product: { podCost: 1225, printfulVariantId: "bc-3001-tee" } }],
})

describe("percentOfGoal", () => {
  it("should return null when no goal is set", () => {
    expect(percentOfGoal(5000, null)).toBeNull()
    expect(percentOfGoal(5000, 0)).toBeNull()
  })

  it("should report progress against the goal", () => {
    expect(percentOfGoal(25_000, 50_000)).toBe(50)
  })

  it("should report exactly 100 when the goal is met", () => {
    expect(percentOfGoal(50_000, 50_000)).toBe(100)
  })

  it("should report above 100 when the goal is exceeded", () => {
    // A campaign that overshot should be able to say so.
    expect(percentOfGoal(70_000, 50_000)).toBe(140)
  })

  it("should be zero before any orders", () => {
    expect(percentOfGoal(0, 50_000)).toBe(0)
  })

  it("should measure net proceeds, not gross sales", () => {
    // $1,000 charged of which $200 is the org's net, against a $500 goal:
    // 40%, not 200%. The goal is a goal for money received.
    expect(percentOfGoal(20_000, 50_000)).toBe(40)
  })
})

describe("barWidthPercent", () => {
  it("should clamp a bar at full", () => {
    expect(barWidthPercent(140)).toBe(100)
  })

  it("should be empty when there is no goal", () => {
    expect(barWidthPercent(null)).toBe(0)
  })

  it("should track the percentage in between", () => {
    expect(barWidthPercent(73)).toBe(73)
  })
})

describe("daysRemaining", () => {
  const now = new Date("2026-08-13T00:00:00Z")

  it("should return null when the campaign has no deadline", () => {
    expect(daysRemaining(null, now)).toBeNull()
  })

  it("should count whole days to the deadline", () => {
    expect(daysRemaining(new Date("2026-08-21T00:00:00Z"), now)).toBe(8)
  })

  it("should floor at zero once the deadline has passed", () => {
    expect(daysRemaining(new Date("2026-08-01T00:00:00Z"), now)).toBe(0)
  })
})

describe("summariseOrders", () => {
  it("should reproduce the measured per-order split", () => {
    const s = summariseOrders([order()])
    expect(s.grossSalesCents).toBe(3269)
    expect(s.netRaisedCents).toBe(1059)
    expect(s.itemsSold).toBe(1)
    expect(s.orderCount).toBe(1)
  })

  it("should exclude refunded orders", () => {
    const s = summariseOrders([order(), order({ status: "refunded" })])
    expect(s.orderCount).toBe(1)
    expect(s.netRaisedCents).toBe(1059)
  })

  it("should exclude abandoned checkouts", () => {
    const s = summariseOrders([order(), order({ status: "pending" })])
    expect(s.orderCount).toBe(1)
  })

  it("should count every status from paid through delivered", () => {
    const s = summariseOrders([
      order({ status: "paid" }),
      order({ status: "fulfilled" }),
      order({ status: "shipped" }),
      order({ status: "delivered" }),
    ])
    expect(s.orderCount).toBe(4)
  })

  it("should count a repeat buyer as one supporter", () => {
    const s = summariseOrders([order(), order()])
    expect(s.orderCount).toBe(2)
    expect(s.supporterCount).toBe(1)
  })

  it("should treat buyer email case-insensitively when counting supporters", () => {
    const s = summariseOrders([order(), order({ buyerEmail: "BUYER@example.com" })])
    expect(s.supporterCount).toBe(1)
  })

  it("should count distinct buyers separately", () => {
    const s = summariseOrders([order(), order({ buyerEmail: "other@example.com" })])
    expect(s.supporterCount).toBe(2)
  })

  it("should not count a supporter with no email on record", () => {
    const s = summariseOrders([order({ buyerEmail: null })])
    expect(s.orderCount).toBe(1)
    expect(s.supporterCount).toBe(0)
  })

  it("should total quantities across items", () => {
    expect(summariseOrders([order({ quantity: 3 })]).itemsSold).toBe(3)
  })

  it("should return zeroes for a campaign with no orders", () => {
    expect(summariseOrders([])).toEqual({
      netRaisedCents: 0, grossSalesCents: 0, itemsSold: 0, orderCount: 0, supporterCount: 0,
    })
  })
})

describe("progressVisibility", () => {
  // Mirrors the matrix in docs/1-requirements/requirements.md.
  it("should show progress to everyone", () => {
    for (const v of ["admin", "member", "student", "public"] as const) {
      expect(progressVisibility(v, "percent_only").showProgress).toBe(true)
    }
  })

  it("should show amounts to admins and members regardless of display mode", () => {
    expect(progressVisibility("admin", "percent_only").showAmounts).toBe(true)
    expect(progressVisibility("member", "percent_only").showAmounts).toBe(true)
  })

  it("should hide amounts from students and the public under percent-only", () => {
    expect(progressVisibility("student", "percent_only").showAmounts).toBe(false)
    expect(progressVisibility("public", "percent_only").showAmounts).toBe(false)
  })

  it("should show amounts to students and the public when the campaign opts in", () => {
    expect(progressVisibility("student", "show_amount").showAmounts).toBe(true)
    expect(progressVisibility("public", "show_amount").showAmounts).toBe(true)
  })

  it("should never expose the payout breakdown to students or the public, even under show_amount", () => {
    expect(progressVisibility("student", "show_amount").showPayoutBreakdown).toBe(false)
    expect(progressVisibility("public", "show_amount").showPayoutBreakdown).toBe(false)
  })

  it("should expose the payout breakdown to admins and members", () => {
    expect(progressVisibility("admin", "percent_only").showPayoutBreakdown).toBe(true)
    expect(progressVisibility("member", "percent_only").showPayoutBreakdown).toBe(true)
  })
})
