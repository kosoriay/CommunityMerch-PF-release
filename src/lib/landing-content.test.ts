import { describe, it, expect, vi } from "vitest"
import {
  LANDING_DEFAULTS,
  LANDING_LIMITS,
  parseStoredContent,
  resolveLandingContent,
  validateLandingContent,
} from "./landing-content"

describe("validateLandingContent", () => {
  it("accepts an empty document", () => {
    expect(validateLandingContent({})).toEqual({ ok: true, value: {} })
  })

  it("rejects non-objects", () => {
    expect(validateLandingContent([]).ok).toBe(false)
    expect(validateLandingContent("x").ok).toBe(false)
    expect(validateLandingContent(null).ok).toBe(false)
  })

  it("accepts a full valid document and trims text", () => {
    const result = validateLandingContent({
      hero: { headline: "  Hello  " },
      testimonials: [{ name: "Aiko", title: "PTA President", quote: "Great!" }],
      faqs: [{ question: "Q?", answer: "A." }],
    })
    expect(result).toEqual({
      ok: true,
      value: {
        hero: { headline: "Hello" },
        testimonials: [{ name: "Aiko", title: "PTA President", quote: "Great!" }],
        faqs: [{ question: "Q?", answer: "A." }],
      },
    })
  })

  it("rejects an over-limit hero headline", () => {
    const result = validateLandingContent({
      hero: { headline: "x".repeat(LANDING_LIMITS.heroHeadline + 1) },
    })
    expect(result.ok).toBe(false)
  })

  it("accepts text exactly at the limit", () => {
    const result = validateLandingContent({
      hero: { headline: "x".repeat(LANDING_LIMITS.heroHeadline) },
    })
    expect(result.ok).toBe(true)
  })

  it("requires exactly 3 how-it-works steps", () => {
    const step = { title: "T", description: "D" }
    expect(validateLandingContent({ howItWorks: [step, step] }).ok).toBe(false)
    expect(validateLandingContent({ howItWorks: [step, step, step] }).ok).toBe(true)
  })

  it("skips all-empty list rows but rejects half-filled ones", () => {
    const skipped = validateLandingContent({
      testimonials: [{ name: "", title: "", quote: "" }],
    })
    expect(skipped).toEqual({ ok: true, value: { testimonials: [] } })
    expect(validateLandingContent({ testimonials: [{ name: "Aiko", quote: "" }] }).ok).toBe(false)
  })

  it("rejects lists above the max item count", () => {
    const items = Array.from({ length: LANDING_LIMITS.maxListItems + 1 }, (_, i) => ({
      question: `Q${i}`,
      answer: "A",
    }))
    expect(validateLandingContent({ faqs: items }).ok).toBe(false)
  })

  it("ignores unknown keys", () => {
    expect(validateLandingContent({ nonsense: 1 })).toEqual({ ok: true, value: {} })
  })

  it("rejects non-string field types", () => {
    expect(validateLandingContent({ hero: { headline: 42 } }).ok).toBe(false)
  })
})

describe("parseStoredContent", () => {
  it("returns {} for null or empty input", () => {
    expect(parseStoredContent(null)).toEqual({})
    expect(parseStoredContent(undefined)).toEqual({})
    expect(parseStoredContent("")).toEqual({})
  })

  it("returns {} for invalid JSON", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    expect(parseStoredContent("{not json")).toEqual({})
    spy.mockRestore()
  })

  it("returns {} for JSON that fails validation", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    expect(parseStoredContent(JSON.stringify({ howItWorks: [] }))).toEqual({})
    spy.mockRestore()
  })

  it("round-trips a valid document", () => {
    const doc = { hero: { headline: "Hi" } }
    expect(parseStoredContent(JSON.stringify(doc))).toEqual(doc)
  })
})

describe("resolveLandingContent", () => {
  it("empty document → all defaults, nothing customized, no testimonials", () => {
    const r = resolveLandingContent({})
    expect(r.hero).toEqual(LANDING_DEFAULTS.hero)
    expect(r.howItWorks).toEqual(LANDING_DEFAULTS.howItWorks)
    expect(r.faqs).toEqual(LANDING_DEFAULTS.faqs)
    expect(r.testimonials).toEqual([])
    expect(r.customized).toEqual({
      hero: false,
      howItWorks: false,
      testimonials: false,
      faqs: false,
    })
  })

  it("hero falls back field-by-field", () => {
    const r = resolveLandingContent({ hero: { headline: "Custom" } })
    expect(r.hero.headline).toBe("Custom")
    expect(r.hero.subtext).toBe(LANDING_DEFAULTS.hero.subtext)
    expect(r.hero.ctaLabel).toBe(LANDING_DEFAULTS.hero.ctaLabel)
    expect(r.customized.hero).toBe(true)
  })

  it("explicitly empty faqs stay empty (section hidden)", () => {
    const r = resolveLandingContent({ faqs: [] })
    expect(r.faqs).toEqual([])
    expect(r.customized.faqs).toBe(true)
  })

  it("stored testimonials pass through in order", () => {
    const items = [
      { name: "B", quote: "2" },
      { name: "A", quote: "1" },
    ]
    expect(resolveLandingContent({ testimonials: items }).testimonials).toEqual(items)
  })

  it("customized howItWorks passes through and is marked customized", () => {
    const steps = [
      { title: "A", description: "1" },
      { title: "B", description: "2" },
      { title: "C", description: "3" },
    ]
    const r = resolveLandingContent({ howItWorks: steps })
    expect(r.howItWorks).toEqual(steps)
    expect(r.customized.howItWorks).toBe(true)
  })

  it("defaults are frozen — in-place mutation throws instead of corrupting", () => {
    expect(() => {
      ;(LANDING_DEFAULTS.howItWorks as { title: string; description: string }[]).push({
        title: "X",
        description: "Y",
      })
    }).toThrow(TypeError)
    expect(() => {
      ;(LANDING_DEFAULTS.hero as { headline: string }).headline = "mutated"
    }).toThrow(TypeError)
    expect(LANDING_DEFAULTS.howItWorks).toHaveLength(3)
    expect(resolveLandingContent({}).hero.headline).not.toBe("mutated")
  })
})
