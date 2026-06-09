import { describe, it, expect } from "vitest"

describe("middleware path matching", () => {
  const PROTECTED_PREFIXES = ["/dashboard"]

  function isProtected(pathname: string) {
    return PROTECTED_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(prefix + "/")
    )
  }

  it("allows root path", () => {
    expect(isProtected("/")).toBe(false)
  })

  it("allows sign-in page", () => {
    expect(isProtected("/sign-in")).toBe(false)
  })

  it("allows auth API routes", () => {
    expect(isProtected("/api/auth/callback/google")).toBe(false)
    expect(isProtected("/api/auth/get-session")).toBe(false)
  })

  it("allows invite paths", () => {
    expect(isProtected("/invite/abc123token")).toBe(false)
  })

  it("allows public campaign slugs", () => {
    expect(isProtected("/lincoln-pta-spring-2026")).toBe(false)
    expect(isProtected("/any-campaign-slug")).toBe(false)
  })

  it("blocks dashboard root", () => {
    expect(isProtected("/dashboard")).toBe(true)
  })

  it("blocks nested dashboard routes", () => {
    expect(isProtected("/dashboard/orgs/abc/campaigns")).toBe(true)
  })

  it("allows setup wizard paths", () => {
    expect(isProtected("/setup")).toBe(false)
    expect(isProtected("/setup/step/1")).toBe(false)
    expect(isProtected("/setup/step/9")).toBe(false)
  })
})
