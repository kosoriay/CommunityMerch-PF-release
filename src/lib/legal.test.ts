import { describe, it, expect } from "vitest"
import { parseMarkdownLite } from "./legal"

describe("parseMarkdownLite", () => {
  it("should parse headings by level", () => {
    const blocks = parseMarkdownLite("# Title\n## Section\n### Sub")
    expect(blocks).toEqual([
      { type: "h1", text: "Title" },
      { type: "h2", text: "Section" },
      { type: "h3", text: "Sub" },
    ])
  })

  it("should join consecutive lines into one paragraph and split on blank lines", () => {
    const blocks = parseMarkdownLite("First line\ncontinues here.\n\nSecond paragraph.")
    expect(blocks).toEqual([
      { type: "p", text: "First line continues here." },
      { type: "p", text: "Second paragraph." },
    ])
  })

  it("should group list items into a single list block", () => {
    const blocks = parseMarkdownLite("- one\n- two\n\nAfter list.")
    expect(blocks).toEqual([
      { type: "ul", items: ["one", "two"] },
      { type: "p", text: "After list." },
    ])
  })

  it("should drop single-line HTML comments", () => {
    const blocks = parseMarkdownLite("<!-- template note -->\n# Title")
    expect(blocks).toEqual([{ type: "h1", text: "Title" }])
  })

  it("should return an empty array for empty input", () => {
    expect(parseMarkdownLite("")).toEqual([])
  })
})
