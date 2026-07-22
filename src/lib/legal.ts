import { readFileSync } from "fs"
import path from "path"
import { getOrCreateConfig } from "@/lib/platform-config"

export type LegalBlock =
  | { type: "h1" | "h2" | "h3" | "p"; text: string }
  | { type: "ul"; items: string[] }

export type LegalDocName = "terms" | "privacy"

// Legal documents live in content/*.md so licensees can edit them on GitHub
// without touching code. {{PLATFORM_NAME}} / {{SUPPORT_EMAIL}} are substituted
// from platform config at request time.
export async function loadLegalDoc(name: LegalDocName): Promise<LegalBlock[]> {
  const config = await getOrCreateConfig()
  const raw = readFileSync(path.join(process.cwd(), "content", `${name}.md`), "utf8")
  const text = raw
    .replaceAll("{{PLATFORM_NAME}}", config.platformName)
    .replaceAll("{{SUPPORT_EMAIL}}", config.supportEmail ?? "the support contact listed on this platform")
  return parseMarkdownLite(text)
}

// Minimal markdown subset: #/##/### headings, "- " lists, blank-line-separated
// paragraphs. Single-line <!-- --> comments are dropped. Kept dependency-free
// on purpose — legal pages don't need a full renderer.
export function parseMarkdownLite(text: string): LegalBlock[] {
  const blocks: LegalBlock[] = []
  let paragraph: string[] = []
  let list: string[] | null = null

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push({ type: "p", text: paragraph.join(" ") })
      paragraph = []
    }
  }
  const flushList = () => {
    if (list) {
      blocks.push({ type: "ul", items: list })
      list = null
    }
  }

  for (const line of text.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || (trimmed.startsWith("<!--") && trimmed.endsWith("-->"))) {
      flushParagraph()
      flushList()
      continue
    }
    if (trimmed.startsWith("### ")) {
      flushParagraph()
      flushList()
      blocks.push({ type: "h3", text: trimmed.slice(4) })
      continue
    }
    if (trimmed.startsWith("## ")) {
      flushParagraph()
      flushList()
      blocks.push({ type: "h2", text: trimmed.slice(3) })
      continue
    }
    if (trimmed.startsWith("# ")) {
      flushParagraph()
      flushList()
      blocks.push({ type: "h1", text: trimmed.slice(2) })
      continue
    }
    if (trimmed.startsWith("- ")) {
      flushParagraph()
      list = list ?? []
      list.push(trimmed.slice(2))
      continue
    }
    flushList()
    paragraph.push(trimmed)
  }
  flushParagraph()
  flushList()
  return blocks
}
