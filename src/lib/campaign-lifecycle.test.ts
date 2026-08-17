import { describe, it, expect } from "vitest"
import { effectiveStatus, isSellingOpen, canReopen } from "./campaign-lifecycle"

const NOW = new Date("2026-08-15T12:00:00Z")

describe("effectiveStatus", () => {
  it("should keep a draft a draft even when the deadline has passed", () => {
    const c = { status: "draft" as const, deadline: new Date("2026-08-01T00:00:00Z") }
    expect(effectiveStatus(c, NOW)).toBe("draft")
  })

  it("should keep an explicitly closed campaign closed", () => {
    const c = { status: "closed" as const, deadline: null }
    expect(effectiveStatus(c, NOW)).toBe("closed")
  })

  it("should treat an active campaign with no deadline as active", () => {
    const c = { status: "active" as const, deadline: null }
    expect(effectiveStatus(c, NOW)).toBe("active")
  })

  it("should treat an active campaign with a future deadline as active", () => {
    const c = { status: "active" as const, deadline: new Date("2026-08-20T00:00:00Z") }
    expect(effectiveStatus(c, NOW)).toBe("active")
  })

  it("should treat an active campaign with a past deadline as closed", () => {
    const c = { status: "active" as const, deadline: new Date("2026-08-10T00:00:00Z") }
    expect(effectiveStatus(c, NOW)).toBe("closed")
  })

  it("should close exactly at the deadline, matching the countdown shown to buyers", () => {
    const c = { status: "active" as const, deadline: NOW }
    expect(effectiveStatus(c, NOW)).toBe("closed")
  })

  it("should still be open one millisecond before the deadline", () => {
    const c = { status: "active" as const, deadline: new Date(NOW.getTime() + 1) }
    expect(effectiveStatus(c, NOW)).toBe("active")
  })
})

describe("isSellingOpen", () => {
  it("should refuse a draft", () => {
    expect(isSellingOpen({ status: "draft", deadline: null }, NOW)).toBe(false)
  })

  it("should refuse a closed campaign", () => {
    expect(isSellingOpen({ status: "closed", deadline: null }, NOW)).toBe(false)
  })

  it("should allow an open campaign", () => {
    expect(isSellingOpen({ status: "active", deadline: null }, NOW)).toBe(true)
  })

  it("should refuse an active campaign whose deadline has passed", () => {
    const c = { status: "active" as const, deadline: new Date("2026-08-10T00:00:00Z") }
    expect(isSellingOpen(c, NOW)).toBe(false)
  })

  it("should not close a campaign that has met its goal — goals are not caps", () => {
    // 達成率はこの関数に渡らない。それが仕様である。目標を超えても売り続けられる。
    const c = { status: "active" as const, deadline: null }
    expect(isSellingOpen(c, NOW)).toBe(true)
  })
})

describe("canReopen", () => {
  const base = { orgClosed: false, orgSuspended: false, now: NOW }

  it("should refuse when the organization is closed", () => {
    const r = canReopen({ ...base, orgClosed: true, deadline: null })
    expect(r).toEqual({ ok: false, error: "This organization is closed." })
  })

  it("should refuse when the organization is suspended", () => {
    const r = canReopen({ ...base, orgSuspended: true, deadline: null })
    expect(r).toEqual({ ok: false, error: "This organization is suspended." })
  })

  it("should refuse a deadline already in the past — it would close again immediately", () => {
    const r = canReopen({ ...base, deadline: new Date("2026-08-10T00:00:00Z") })
    expect(r).toEqual({
      ok: false,
      error: "Set a deadline in the future, or clear it, before reopening.",
    })
  })

  it("should allow reopening with no deadline", () => {
    expect(canReopen({ ...base, deadline: null })).toEqual({ ok: true })
  })

  it("should allow reopening with a future deadline", () => {
    const r = canReopen({ ...base, deadline: new Date("2026-09-01T00:00:00Z") })
    expect(r).toEqual({ ok: true })
  })

  it("should report the organization problem before the deadline problem", () => {
    // 期限も直せと言われた上で結局断られる、という往復を避ける
    const r = canReopen({
      ...base,
      orgClosed: true,
      deadline: new Date("2026-08-10T00:00:00Z"),
    })
    expect(r).toEqual({ ok: false, error: "This organization is closed." })
  })
})
