import type { PrintfulPackingSlip } from "@/lib/providers/printful"

// Printful caps the packing slip message; keep well under it and never let a
// long org/campaign name push the support contact off the slip.
const MAX_MESSAGE_LENGTH = 300

/**
 * Build the per-order packing slip.
 *
 * Printful ships to the buyer directly, so the parcel is the only physical
 * touchpoint the buyer gets. Without this the slip carries the Printful store
 * defaults and names neither the organization nor the platform, leaving buyers
 * to guess who to contact — the common wrong guess being Printful, who has no
 * relationship with them, or the printer's return address, where a package sent
 * back without an approved claim is simply lost.
 */
export function buildPackingSlip(params: {
  platformName: string
  supportEmail: string | null
  logoUrl: string | null
  orgName: string
  campaignTitle: string
}): PrintfulPackingSlip {
  const { platformName, supportEmail, logoUrl, orgName, campaignTitle } = params

  const contact = supportEmail
    ? `Questions or a problem with your order? Contact ${supportEmail}.`
    : `Questions or a problem with your order? Contact ${platformName}.`

  const message = truncate(
    `Thank you for supporting ${orgName} — ${campaignTitle}. ` +
      `Fulfilled by ${platformName}. ` +
      contact +
      ` Please do not ship returns to the printing facility on this parcel.`,
    MAX_MESSAGE_LENGTH
  )

  return {
    message,
    ...(supportEmail ? { email: supportEmail } : {}),
    ...(logoUrl ? { logo_url: logoUrl } : {}),
  }
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`
}
