import { describe, it, expect, vi } from "vitest"

// Mock the DB client so the module can load without real env vars
vi.mock("@/lib/db/client", () => ({ db: {} }))

import { hasRole } from "./require-org-access"

describe("hasRole", () => {
  it("admin satisfies all roles", () => {
    expect(hasRole("admin", "admin")).toBe(true)
    expect(hasRole("admin", "member")).toBe(true)
    expect(hasRole("admin", "student")).toBe(true)
    expect(hasRole("admin", "buyer")).toBe(true)
  })

  it("member satisfies member, student, buyer but not admin", () => {
    expect(hasRole("member", "admin")).toBe(false)
    expect(hasRole("member", "member")).toBe(true)
    expect(hasRole("member", "student")).toBe(true)
    expect(hasRole("member", "buyer")).toBe(true)
  })

  it("student satisfies student and buyer only", () => {
    expect(hasRole("student", "admin")).toBe(false)
    expect(hasRole("student", "member")).toBe(false)
    expect(hasRole("student", "student")).toBe(true)
    expect(hasRole("student", "buyer")).toBe(true)
  })

  it("buyer satisfies buyer only", () => {
    expect(hasRole("buyer", "admin")).toBe(false)
    expect(hasRole("buyer", "member")).toBe(false)
    expect(hasRole("buyer", "student")).toBe(false)
    expect(hasRole("buyer", "buyer")).toBe(true)
  })
})
