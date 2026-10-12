import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

vi.mock("@/lib/providers/r2", () => ({ uploadToR2: vi.fn() }))
vi.mock("server-only", () => ({}))

import { uploadToR2 } from "@/lib/providers/r2"
import { isR2Configured, rehostMockup } from "./mockup-rehost"
import { REQUIRED_R2_ENV_VARS } from "./r2-keys"

describe("isR2Configured", () => {
  const saved: Record<string, string | undefined> = {}

  beforeEach(() => {
    for (const name of REQUIRED_R2_ENV_VARS) {
      saved[name] = process.env[name]
      process.env[name] = "set"
    }
  })

  afterEach(() => {
    for (const name of REQUIRED_R2_ENV_VARS) {
      if (saved[name] === undefined) delete process.env[name]
      else process.env[name] = saved[name]
    }
  })

  it("is true when every required variable is set", () => {
    expect(isR2Configured()).toBe(true)
  })

  it.each([...REQUIRED_R2_ENV_VARS])("is false when %s alone is missing", (name) => {
    delete process.env[name]
    expect(isR2Configured()).toBe(false)
  })

  it("is false when a required variable is an empty string", () => {
    process.env.CLOUDFLARE_R2_PUBLIC_URL = ""
    expect(isR2Configured()).toBe(false)
  })
})

describe("rehostMockup content types", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("still refuses svg from the source, although uploads accept it", async () => {
    // 共有の拡張子表には svg がある（/api/upload 用）。Printful 由来の複製では
    // 従来どおり受け入れない。公開バケットから svg を配る経路を増やさない
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => "image/svg+xml" },
      arrayBuffer: async () => new ArrayBuffer(10),
    } as unknown as Response))

    expect(await rehostMockup("https://x/y", "mockups/c1/base")).toBeNull()
    expect(uploadToR2).not.toHaveBeenCalled()
  })
})
