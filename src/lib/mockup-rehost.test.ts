import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/providers/r2", () => ({ uploadToR2: vi.fn() }))
vi.mock("server-only", () => ({}))

import { uploadToR2 } from "@/lib/providers/r2"
import {
  rehostMockup, campaignMockupKeyBase, designPreviewKeyBase, MAX_MOCKUP_BYTES,
} from "./mockup-rehost"

const PNG = "image/png"
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/

function res(args: { ok?: boolean; type?: string; bytes?: number }) {
  const { ok = true, type = PNG, bytes = 1024 } = args
  return {
    ok,
    headers: { get: (h: string) => (h.toLowerCase() === "content-type" ? type : null) },
    arrayBuffer: async () => new ArrayBuffer(bytes),
  } as unknown as Response
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(uploadToR2).mockResolvedValue("https://r2.example.com/mockups/x.png")
})

describe("campaignMockupKeyBase", () => {
  it("scopes the key by campaign and product, slugifies the colour, and stays unique", () => {
    const a = campaignMockupKeyBase("c1", "bc-3001-tee", "Heather Deep Teal")
    expect(a).toMatch(/^mockups\/c1\/bc-3001-tee-heather-deep-teal-/)
    expect(a).toMatch(UUID)
    // 同じ引数でも毎回違う。決定的キーだと再生成で r2.dev が古い画像を返す（設計 §5.3）
    expect(campaignMockupKeyBase("c1", "bc-3001-tee", "Heather Deep Teal")).not.toBe(a)
  })

  it("keeps the mockups/ prefix so the orphan sweep can see it", () => {
    expect(designPreviewKeyBase()).toMatch(/^mockups\/design-previews\//)
  })
})

describe("rehostMockup", () => {
  it("uploads the fetched bytes and returns the R2 url", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(res({})))

    const url = await rehostMockup("https://printful-upload.example/tmp/a.png", "mockups/c1/base")

    expect(url).toBe("https://r2.example.com/mockups/x.png")
    expect(uploadToR2).toHaveBeenCalledWith("mockups/c1/base.png", expect.any(Buffer), PNG)
  })

  it("returns null and uploads nothing when the source is already gone", async () => {
    // まさに今回の障害の形。403 を画像として保存してはいけない
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(res({ ok: false })))

    expect(await rehostMockup("https://printful-upload.example/tmp/dead.png", "mockups/c1/base")).toBeNull()
    expect(uploadToR2).not.toHaveBeenCalled()
  })

  it("returns null when the response is not an image", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(res({ type: "text/html" })))

    expect(await rehostMockup("https://x/y", "mockups/c1/base")).toBeNull()
    expect(uploadToR2).not.toHaveBeenCalled()
  })

  it("returns null when the image is over the size limit", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(res({ bytes: MAX_MOCKUP_BYTES + 1 })))

    expect(await rehostMockup("https://x/y", "mockups/c1/base")).toBeNull()
    expect(uploadToR2).not.toHaveBeenCalled()
  })

  it("returns null on an empty body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(res({ bytes: 0 })))

    expect(await rehostMockup("https://x/y", "mockups/c1/base")).toBeNull()
  })

  it("returns null when fetch throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNRESET")))

    expect(await rehostMockup("https://x/y", "mockups/c1/base")).toBeNull()
  })

  it("returns null when the upload fails, rather than falling back to the temporary url", async () => {
    // Printful URL を代わりに入れると、不変条件が破れて cron が永久に貼り替え続ける
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(res({})))
    vi.mocked(uploadToR2).mockRejectedValue(new Error("R2 down"))

    expect(await rehostMockup("https://x/y", "mockups/c1/base")).toBeNull()
  })

  it("maps jpeg and webp to their own extensions", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(res({ type: "image/jpeg; charset=binary" })))
    await rehostMockup("https://x/y", "mockups/c1/base")
    expect(uploadToR2).toHaveBeenCalledWith("mockups/c1/base.jpg", expect.any(Buffer), "image/jpeg")
  })
})
