import { describe, it, expect } from "vitest"
import { parseOrderQuery, escapeLike, shortOrderId } from "@/lib/order-search"

describe("parseOrderQuery", () => {
  it("should return null when the query is empty or whitespace", () => {
    expect(parseOrderQuery("")).toBeNull()
    expect(parseOrderQuery("   ")).toBeNull()
  })

  it("should lower-case the id prefix so an uppercase short id from a buyer matches", () => {
    // Buyers quote the form shown on the confirmation page: uppercase hex.
    expect(parseOrderQuery("A1B2C3D4")?.idPrefix).toBe("a1b2c3d4")
  })

  it("should preserve case for the email and name substring", () => {
    expect(parseOrderQuery("Alex@Example.com")?.contains).toBe("Alex@Example.com")
  })

  it("should trim surrounding whitespace pasted from an email", () => {
    const q = parseOrderQuery("  a1b2c3d4  ")
    expect(q?.idPrefix).toBe("a1b2c3d4")
    expect(q?.contains).toBe("a1b2c3d4")
  })

  it("should escape LIKE wildcards so a query cannot match every order", () => {
    expect(parseOrderQuery("%")?.idPrefix).toBe("\\%")
    expect(parseOrderQuery("_")?.contains).toBe("\\_")
  })
})

describe("escapeLike", () => {
  it("should escape backslash, percent, and underscore", () => {
    expect(escapeLike("a%b_c\\d")).toBe("a\\%b\\_c\\\\d")
  })

  it("should leave an ordinary email untouched apart from its underscore", () => {
    expect(escapeLike("first_last@example.com")).toBe("first\\_last@example.com")
  })
})

describe("shortOrderId", () => {
  it("should produce the uppercase 8-character form buyers are shown", () => {
    expect(shortOrderId("a1b2c3d4-e5f6-7890-abcd-ef1234567890")).toBe("A1B2C3D4")
  })
})
