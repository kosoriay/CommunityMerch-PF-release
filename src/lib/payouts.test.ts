import { describe, it, expect } from "vitest"

import { getPayoutStatus, payoutReplaceConfirmationMatches } from "./payouts"

describe("getPayoutStatus", () => {
  it("should return ready when onboarding is complete", () => {
    expect(
      getPayoutStatus({ stripeAccountId: "acct_123", stripeOnboardingComplete: true })
    ).toBe("ready")
  })

  it("should return in_progress when an account exists but onboarding is not complete", () => {
    expect(
      getPayoutStatus({ stripeAccountId: "acct_123", stripeOnboardingComplete: false })
    ).toBe("in_progress")
  })

  it("should return not_setup when there is no stripe account", () => {
    expect(
      getPayoutStatus({ stripeAccountId: null, stripeOnboardingComplete: false })
    ).toBe("not_setup")
  })

  it("should return not_setup when stripeAccountId is undefined", () => {
    expect(getPayoutStatus({ stripeAccountId: undefined, stripeOnboardingComplete: false })).toBe(
      "not_setup"
    )
  })

  it("should return not_setup when stripeAccountId is an empty string", () => {
    expect(getPayoutStatus({ stripeAccountId: "", stripeOnboardingComplete: false })).toBe(
      "not_setup"
    )
  })

  it("should return in_progress when stripeOnboardingComplete is null but an account exists", () => {
    expect(
      getPayoutStatus({ stripeAccountId: "acct_123", stripeOnboardingComplete: null })
    ).toBe("in_progress")
  })

  it("should return in_progress when stripeOnboardingComplete is undefined but an account exists", () => {
    expect(
      getPayoutStatus({ stripeAccountId: "acct_123", stripeOnboardingComplete: undefined })
    ).toBe("in_progress")
  })

  it("should return not_setup when both fields are missing", () => {
    expect(getPayoutStatus({})).toBe("not_setup")
  })
})

describe("payoutReplaceConfirmationMatches", () => {
  it("should return true when the typed input exactly matches the org name", () => {
    expect(payoutReplaceConfirmationMatches("Acme Fundraising", "Acme Fundraising")).toBe(true)
  })

  it("should return true when surrounding whitespace is trimmed from both sides", () => {
    expect(payoutReplaceConfirmationMatches("  Acme Fundraising  ", "Acme Fundraising")).toBe(true)
    expect(payoutReplaceConfirmationMatches("Acme Fundraising", "  Acme Fundraising  ")).toBe(true)
  })

  it("should return false when the typed input is empty", () => {
    expect(payoutReplaceConfirmationMatches("", "Acme Fundraising")).toBe(false)
  })

  it("should return false when the typed input is whitespace only", () => {
    expect(payoutReplaceConfirmationMatches("   ", "Acme Fundraising")).toBe(false)
  })

  it("should return false when the typed input is null or undefined", () => {
    expect(payoutReplaceConfirmationMatches(null, "Acme Fundraising")).toBe(false)
    expect(payoutReplaceConfirmationMatches(undefined, "Acme Fundraising")).toBe(false)
  })

  it("should return false when the typed input does not match the org name", () => {
    expect(payoutReplaceConfirmationMatches("Acme Fundraisin", "Acme Fundraising")).toBe(false)
  })

  it("should return false on a case difference", () => {
    expect(payoutReplaceConfirmationMatches("acme fundraising", "Acme Fundraising")).toBe(false)
  })

  it("should return false when the org name itself is empty", () => {
    expect(payoutReplaceConfirmationMatches("", "")).toBe(false)
  })
})
