// Printful limits order external_id to 32 characters — a UUID stripped of its
// hyphens is exactly 32, so the mapping is lossless and reversible.

export function toPrintfulExternalId(orderId: string): string {
  return orderId.replace(/-/g, "")
}

export function fromPrintfulExternalId(externalId: string): string {
  if (externalId.includes("-") || externalId.length !== 32) return externalId
  return [
    externalId.slice(0, 8),
    externalId.slice(8, 12),
    externalId.slice(12, 16),
    externalId.slice(16, 20),
    externalId.slice(20),
  ].join("-")
}
