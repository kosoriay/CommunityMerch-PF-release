import { describe, it, expect } from "vitest"
import { validatePrompt } from "./openai"

describe("validatePrompt", () => {
  it("accepts a valid prompt", () => {
    const result = validatePrompt("Lincoln Elementary PTA Spring 2026 bear mascot")
    expect(result.valid).toBe(true)
  })

  it("rejects prompt containing copyrighted IP", () => {
    expect(validatePrompt("Mickey Mouse design").valid).toBe(false)
    expect(validatePrompt("Spider-Man logo").valid).toBe(false)
    expect(validatePrompt("NFL team logo").valid).toBe(false)
  })

  it("rejects prompt that is too short", () => {
    expect(validatePrompt("hi").valid).toBe(false)
  })

  it("rejects prompt that is too long", () => {
    expect(validatePrompt("a".repeat(501)).valid).toBe(false)
  })

  it("is case-insensitive for blocked terms", () => {
    expect(validatePrompt("DISNEY characters").valid).toBe(false)
    expect(validatePrompt("Marvel Heroes").valid).toBe(false)
  })
})
