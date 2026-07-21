export const PREVIEW_DRAFT_TTL_MS = 24 * 60 * 60 * 1000 // 24h
const PREFIX = "previewDraft:"

export type PreviewDraftProduct = {
  variantId: string
  retailDollars: string
  colors: string[]
}

export type PreviewDraft = {
  v: 1
  ts: number
  name: string
  products: PreviewDraftProduct[]
  goalDollars: string
  deadline: string
}

function makeNonce(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 16)
}

export function savePreviewDraft(draft: Omit<PreviewDraft, "v" | "ts">): string {
  const nonce = makeNonce()
  const payload: PreviewDraft = { v: 1, ts: Date.now(), ...draft }
  window.localStorage.setItem(PREFIX + nonce, JSON.stringify(payload))
  return nonce
}

export function loadPreviewDraft(nonce: string): PreviewDraft | null {
  if (!nonce) return null
  const raw = window.localStorage.getItem(PREFIX + nonce)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as PreviewDraft
    if (parsed?.v !== 1 || typeof parsed.ts !== "number") return null
    if (Date.now() - parsed.ts > PREVIEW_DRAFT_TTL_MS) return null
    return parsed
  } catch {
    return null
  }
}

export function clearPreviewDraft(nonce: string): void {
  window.localStorage.removeItem(PREFIX + nonce)
}
