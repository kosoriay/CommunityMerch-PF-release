import { describe, it, expect } from "vitest"
import { toPrintfulExternalId, fromPrintfulExternalId } from "./printful-ids"

describe("printful external id mapping", () => {
  it("should strip hyphens down to exactly 32 chars", () => {
    const id = "e5fd8539-1234-4abc-9def-0123456789ab"
    expect(toPrintfulExternalId(id)).toHaveLength(32)
    expect(toPrintfulExternalId(id)).not.toContain("-")
  })

  it("should round-trip a UUID", () => {
    const id = "e5fd8539-1234-4abc-9def-0123456789ab"
    expect(fromPrintfulExternalId(toPrintfulExternalId(id))).toBe(id)
  })

  it("should pass through non-UUID external ids unchanged", () => {
    expect(fromPrintfulExternalId("legacy-id")).toBe("legacy-id")
    expect(fromPrintfulExternalId("short")).toBe("short")
  })
})
