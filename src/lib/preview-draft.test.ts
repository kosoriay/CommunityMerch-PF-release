import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import {
  savePreviewDraft, loadPreviewDraft, clearPreviewDraft, PREVIEW_DRAFT_TTL_MS,
} from "./preview-draft"

// Mirrors the private PREFIX constant in preview-draft.ts (not exported).
const STORAGE_PREFIX = "previewDraft:"

function installFakeStorage() {
  const store = new Map<string, string>()
  const ls = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, String(v)) },
    removeItem: (k: string) => { store.delete(k) },
    clear: () => { store.clear() },
  }
  vi.stubGlobal("localStorage", ls)
  vi.stubGlobal("window", { localStorage: ls })
  return ls
}

describe("preview-draft", () => {
  beforeEach(() => { installFakeStorage(); vi.useRealTimers() })
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

  const sample = {
    name: "Sakura 6th Grade",
    products: [{ variantId: "v1", retailDollars: "28.00", colors: ["White", "Navy"] }],
    goalDollars: "500",
    deadline: "2026-08-01",
  }

  it("round-trips a saved draft by nonce", () => {
    const nonce = savePreviewDraft(sample)
    expect(nonce).toMatch(/^[a-f0-9]{16}$/)
    const loaded = loadPreviewDraft(nonce)
    expect(loaded?.name).toBe("Sakura 6th Grade")
    expect(loaded?.v).toBe(1)
    expect(typeof loaded?.ts).toBe("number")
    expect(loaded?.goalDollars).toBe("500")
    expect(loaded?.deadline).toBe("2026-08-01")
    expect(loaded?.products[0]).toEqual({
      variantId: "v1",
      retailDollars: "28.00",
      colors: ["White", "Navy"],
    })
  })

  it("returns null for an unknown nonce", () => {
    expect(loadPreviewDraft("deadbeefdeadbeef")).toBeNull()
    expect(loadPreviewDraft("")).toBeNull()
  })

  it("returns null when the stored payload has an unsupported version", () => {
    const nonce = "aaaaaaaaaaaaaaaa"
    localStorage.setItem(
      STORAGE_PREFIX + nonce,
      JSON.stringify({ ...sample, v: 2, ts: Date.now() }),
    )
    expect(loadPreviewDraft(nonce)).toBeNull()
  })

  it("returns null when the stored payload has a non-numeric ts", () => {
    const nonce = "bbbbbbbbbbbbbbbb"
    localStorage.setItem(
      STORAGE_PREFIX + nonce,
      JSON.stringify({ ...sample, v: 1, ts: "not-a-number" }),
    )
    expect(loadPreviewDraft(nonce)).toBeNull()
  })

  it("returns null when the stored payload is not parsable JSON", () => {
    const nonce = "cccccccccccccccc"
    localStorage.setItem(STORAGE_PREFIX + nonce, "{not json")
    expect(loadPreviewDraft(nonce)).toBeNull()
  })

  it("returns null once the TTL has elapsed", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-07-21T00:00:00Z"))
    const nonce = savePreviewDraft(sample)
    vi.setSystemTime(new Date(Date.now() + PREVIEW_DRAFT_TTL_MS + 1))
    expect(loadPreviewDraft(nonce)).toBeNull()
  })

  it("clears a draft", () => {
    const nonce = savePreviewDraft(sample)
    clearPreviewDraft(nonce)
    expect(loadPreviewDraft(nonce)).toBeNull()
  })
})
