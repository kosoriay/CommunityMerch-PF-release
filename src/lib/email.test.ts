import { describe, it, expect } from "vitest"

import { escapeHtml } from "./email"

describe("escapeHtml", () => {
  it("should escape ampersands", () => {
    expect(escapeHtml("Tom & Jerry")).toBe("Tom &amp; Jerry")
  })

  it("should escape less-than signs", () => {
    expect(escapeHtml("a < b")).toBe("a &lt; b")
  })

  it("should escape greater-than signs", () => {
    expect(escapeHtml("a > b")).toBe("a &gt; b")
  })

  it("should escape double quotes", () => {
    expect(escapeHtml('say "hi"')).toBe("say &quot;hi&quot;")
  })

  it("should escape single quotes", () => {
    expect(escapeHtml("it's fine")).toBe("it&#39;s fine")
  })

  it("should escape a script tag injection attempt", () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;"
    )
  })

  it("should escape a mixed string with multiple special characters", () => {
    expect(escapeHtml(`<b>O'Brien & "Sons"</b>`)).toBe(
      "&lt;b&gt;O&#39;Brien &amp; &quot;Sons&quot;&lt;/b&gt;"
    )
  })

  it("should leave a string with no special characters unchanged", () => {
    expect(escapeHtml("Acme Fundraising")).toBe("Acme Fundraising")
  })

  it("should return an empty string when given an empty string", () => {
    expect(escapeHtml("")).toBe("")
  })
})
