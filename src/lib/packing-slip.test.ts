import { describe, it, expect } from "vitest"
import { buildPackingSlip } from "@/lib/packing-slip"

const base = {
  platformName: "SwagFund",
  supportEmail: "help@swagfund.org",
  logoUrl: "https://cdn.example.com/logo.png",
  orgName: "Lincoln Elementary PTA",
  campaignTitle: "Spring Book Drive",
}

describe("buildPackingSlip", () => {
  it("should name the organization and the campaign when both are provided", () => {
    const slip = buildPackingSlip(base)
    expect(slip.message).toContain("Lincoln Elementary PTA")
    expect(slip.message).toContain("Spring Book Drive")
  })

  it("should carry the support email in both the email field and the message", () => {
    const slip = buildPackingSlip(base)
    expect(slip.email).toBe("help@swagfund.org")
    expect(slip.message).toContain("help@swagfund.org")
  })

  it("should warn against returning the parcel to the printing facility", () => {
    const slip = buildPackingSlip(base)
    expect(slip.message).toContain("do not ship returns to the printing facility")
  })

  it("should fall back to the platform name when no support email is configured", () => {
    const slip = buildPackingSlip({ ...base, supportEmail: null })
    expect(slip.email).toBeUndefined()
    expect(slip.message).toContain("Contact SwagFund")
  })

  it("should omit logo_url when no logo is configured", () => {
    const slip = buildPackingSlip({ ...base, logoUrl: null })
    expect(slip.logo_url).toBeUndefined()
  })

  it("should keep the message within the Printful length cap for long names", () => {
    const slip = buildPackingSlip({
      ...base,
      orgName: "O".repeat(400),
      campaignTitle: "C".repeat(400),
    })
    expect(slip.message!.length).toBeLessThanOrEqual(300)
  })
})
