import { describe, it, expect, vi, beforeEach } from "vitest"

const findOrder = vi.fn()
const findOrg = vi.fn()
const updateSet = vi.fn()

vi.mock("@/lib/db/client", () => ({
  db: {
    query: {
      orders: { findFirst: (...a: unknown[]) => findOrder(...a) },
      organizations: { findFirst: (...a: unknown[]) => findOrg(...a) },
      campaigns: { findFirst: vi.fn() },
    },
    update: () => ({
      set: (values: unknown) => {
        updateSet(values)
        return { where: () => Promise.resolve() }
      },
    }),
  },
}))

const refundsCreate = vi.fn()
const balanceRetrieve = vi.fn()
vi.mock("@/lib/providers/stripe", () => ({
  stripe: {
    refunds: { create: (...a: unknown[]) => refundsCreate(...a) },
    balance: { retrieve: (...a: unknown[]) => balanceRetrieve(...a) },
  },
}))

import { refundOrder, refundBreakdown, orderRefundBreakdown } from "./refunds"

// Mirrors the measured example: $24.00 tee + $4.69 shipping = $28.69 charged,
// $21.61 application fee, so the organization nets $7.08.
const PAID_ORDER = {
  id: "order-1",
  status: "delivered",
  stripePaymentIntentId: "pi_123",
  totalAmountCents: 2400,
  campaign: { orgId: "org-1", platformFeeRate: 900 },
  items: [{ quantity: 1, product: { podCost: 1225, printfulVariantId: "bc-3001-tee" } }],
}

beforeEach(() => {
  findOrder.mockReset()
  findOrg.mockReset()
  updateSet.mockReset()
  refundsCreate.mockReset()
  balanceRetrieve.mockReset()
  findOrg.mockResolvedValue({ id: "org-1", name: "Lincoln PTA", stripeAccountId: "acct_1" })
  balanceRetrieve.mockResolvedValue({
    available: [{ amount: 100_000, currency: "usd" }],
    pending: [],
  })
  refundsCreate.mockResolvedValue({ id: "re_1", transfer_reversal: "trr_1" })
})

const call = (overrides = {}) =>
  refundOrder({ orderId: "order-1", reason: "Misprinted", refundedByUserId: "user-1", ...overrides })

describe("refundOrder", () => {
  it("should send both Stripe flags, because reverse_transfer alone drives the organization negative", async () => {
    findOrder.mockResolvedValue(PAID_ORDER)
    const result = await call()

    expect(result.ok).toBe(true)
    expect(refundsCreate).toHaveBeenCalledWith({
      payment_intent: "pi_123",
      reverse_transfer: true,
      refund_application_fee: true,
    })
  })

  it("should record the audit trail when the refund succeeds", async () => {
    findOrder.mockResolvedValue(PAID_ORDER)
    await call()

    const written = updateSet.mock.calls[0][0] as Record<string, unknown>
    expect(written.status).toBe("refunded")
    expect(written.refundedBy).toBe("user-1")
    expect(written.refundReason).toBe("Misprinted")
    expect(written.stripeRefundId).toBe("re_1")
    expect(written.transferReversalId).toBe("trr_1")
  })

  it("should refuse an order that is already refunded", async () => {
    findOrder.mockResolvedValue({ ...PAID_ORDER, status: "refunded" })
    const result = await call()

    expect(result).toEqual({ ok: false, error: "This order has already been refunded" })
    expect(refundsCreate).not.toHaveBeenCalled()
  })

  it("should refuse a pending order, where the buyer was never charged", async () => {
    findOrder.mockResolvedValue({ ...PAID_ORDER, status: "pending" })
    const result = await call()

    expect(result.ok).toBe(false)
    expect(refundsCreate).not.toHaveBeenCalled()
  })

  it("should require a reason", async () => {
    findOrder.mockResolvedValue(PAID_ORDER)
    const result = await call({ reason: "   " })

    expect(result).toEqual({ ok: false, error: "A reason is required" })
    expect(refundsCreate).not.toHaveBeenCalled()
  })

  it("should leave the order status unchanged when Stripe fails", async () => {
    findOrder.mockResolvedValue(PAID_ORDER)
    refundsCreate.mockRejectedValue(new Error("card_declined"))

    const result = await call()

    expect(result.ok).toBe(false)
    // An order marked refunded when Stripe never refunded is unrecoverable —
    // nobody would go looking again.
    expect(updateSet).not.toHaveBeenCalled()
  })

  it("should not warn when the balance covers the organization's net share", async () => {
    // The reversal and the fee refund settle together, so the account only
    // moves by the net ($7.08) — checking against the gross charge reported a
    // shortfall on every refund, since an org never holds more than its net.
    findOrder.mockResolvedValue(PAID_ORDER)
    balanceRetrieve.mockResolvedValue({ available: [{ amount: 708, currency: "usd" }], pending: [] })

    const result = await call()

    expect(result.ok).toBe(true)
    expect(refundsCreate).toHaveBeenCalled()
  })

  it("should ask for confirmation when the connected account cannot cover its net share", async () => {
    findOrder.mockResolvedValue(PAID_ORDER)
    balanceRetrieve.mockResolvedValue({ available: [{ amount: 500, currency: "usd" }], pending: [] })

    const result = await call()

    expect(result.ok).toBe(false)
    expect(result).toMatchObject({ needsConfirmation: true })
    expect(refundsCreate).not.toHaveBeenCalled()
  })

  it("should proceed past a shortfall once acknowledged", async () => {
    findOrder.mockResolvedValue(PAID_ORDER)
    balanceRetrieve.mockResolvedValue({ available: [{ amount: 500, currency: "usd" }], pending: [] })

    const result = await call({ acknowledgeShortfall: true })

    expect(result.ok).toBe(true)
    expect(refundsCreate).toHaveBeenCalled()
  })

  it("should not block the refund when the balance lookup fails", async () => {
    findOrder.mockResolvedValue(PAID_ORDER)
    balanceRetrieve.mockRejectedValue(new Error("Stripe down"))

    const result = await call()

    expect(result.ok).toBe(true)
  })

  it("should ignore non-USD balances when judging the shortfall", async () => {
    findOrder.mockResolvedValue(PAID_ORDER)
    balanceRetrieve.mockResolvedValue({
      available: [{ amount: 1_000_000, currency: "jpy" }],
      pending: [],
    })

    const result = await call()

    expect(result).toMatchObject({ needsConfirmation: true })
  })
})

describe("orderRefundBreakdown", () => {
  it("should reproduce the charge and split it from stored order data alone", () => {
    // No Stripe call and no dependence on today's catalog prices — the campaign
    // fee snapshot and the POD cost recorded on the product are enough.
    expect(orderRefundBreakdown(PAID_ORDER)).toEqual({
      buyerReceivesCents: 2869,
      organizationReturnsCents: 708,
      platformAbsorbsCents: 2161,
    })
  })
})

describe("refundBreakdown", () => {
  it("should split a refund into the organization's share and the platform's unrecoverable share", () => {
    // Measured example: $28.69 charge, $21.61 application fee, org nets $7.08.
    expect(refundBreakdown({ itemSubtotalCents: 2400, shippingCents: 469, applicationFeeCents: 2161 })).toEqual({
      buyerReceivesCents: 2869,
      organizationReturnsCents: 708,
      platformAbsorbsCents: 2161,
    })
  })

  it("should never ask the organization to return a negative amount", () => {
    const r = refundBreakdown({ itemSubtotalCents: 1000, shippingCents: 0, applicationFeeCents: 1500 })
    expect(r.organizationReturnsCents).toBe(0)
    expect(r.platformAbsorbsCents).toBe(1000)
  })
})
