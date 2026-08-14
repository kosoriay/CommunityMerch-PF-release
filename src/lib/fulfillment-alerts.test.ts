import { describe, it, expect, vi, beforeEach } from "vitest"

const findUsers = vi.fn()
vi.mock("@/lib/db/client", () => ({
  db: { query: { user: { findMany: (...a: unknown[]) => findUsers(...a) } } },
}))

const getConfig = vi.fn()
vi.mock("@/lib/platform-config", () => ({
  getOrCreateConfig: () => getConfig(),
}))

const sendEmail = vi.fn()
vi.mock("@/lib/email", () => ({
  sendFulfillmentFailureEmail: (...a: unknown[]) => sendEmail(...a),
}))

import { alertFulfillmentFailure } from "@/lib/fulfillment-alerts"

const params = {
  orderId: "order-1",
  campaignTitle: "Spring Fundraiser",
  orgName: "Lincoln PTA",
  buyerEmail: "buyer@example.com",
  error: "Invalid recipient state code",
  attempts: 1,
}

beforeEach(() => {
  findUsers.mockReset()
  getConfig.mockReset()
  sendEmail.mockReset()
  getConfig.mockResolvedValue({ platformName: "SwagFund", supportEmail: "help@swagfund.org" })
  sendEmail.mockResolvedValue(undefined)
})

describe("alertFulfillmentFailure", () => {
  it("should notify every platform admin", async () => {
    findUsers.mockResolvedValue([{ email: "a@example.com" }, { email: "b@example.com" }])

    await alertFulfillmentFailure(params)

    expect(sendEmail).toHaveBeenCalledTimes(1)
    expect(sendEmail.mock.calls[0][0]).toEqual(["a@example.com", "b@example.com"])
  })

  it("should fall back to the support address when no admin exists", async () => {
    findUsers.mockResolvedValue([])

    await alertFulfillmentFailure(params)

    expect(sendEmail.mock.calls[0][0]).toEqual(["help@swagfund.org"])
  })

  it("should not send at all when there is nobody to notify", async () => {
    findUsers.mockResolvedValue([])
    getConfig.mockResolvedValue({ platformName: "SwagFund", supportEmail: null })

    await alertFulfillmentFailure(params)

    expect(sendEmail).not.toHaveBeenCalled()
  })

  it("should pass the error and attempt count through for the operator to act on", async () => {
    findUsers.mockResolvedValue([{ email: "a@example.com" }])

    await alertFulfillmentFailure(params)

    expect(sendEmail.mock.calls[0][1]).toMatchObject({
      orderId: "order-1",
      error: "Invalid recipient state code",
      attempts: 1,
      platformName: "SwagFund",
    })
  })

  it("should never throw, because the caller is already handling a failure", async () => {
    // An alerting bug must not turn a recorded fulfilment failure into an
    // unhandled exception that loses the record entirely.
    findUsers.mockRejectedValue(new Error("database down"))

    await expect(alertFulfillmentFailure(params)).resolves.toBeUndefined()
  })

  it("should not throw when sending the email itself fails", async () => {
    findUsers.mockResolvedValue([{ email: "a@example.com" }])
    sendEmail.mockRejectedValue(new Error("Resend down"))

    await expect(alertFulfillmentFailure(params)).resolves.toBeUndefined()
  })
})
