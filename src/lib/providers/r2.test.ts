import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { r2KeyFromUrl } from "./r2"
import { REQUIRED_R2_ENV_VARS } from "@/lib/r2-keys"

const PUB = "https://pub-abc.r2.dev"

describe("r2KeyFromUrl strictness", () => {
  const saved: Record<string, string | undefined> = {}

  beforeAll(() => {
    for (const name of REQUIRED_R2_ENV_VARS) saved[name] = process.env[name]
    for (const name of REQUIRED_R2_ENV_VARS) process.env[name] = "test"
    process.env.CLOUDFLARE_R2_PUBLIC_URL = PUB
  })

  afterAll(() => {
    for (const name of REQUIRED_R2_ENV_VARS) {
      if (saved[name] === undefined) delete process.env[name]
      else process.env[name] = saved[name]
    }
  })

  it("returns the key for a url on the current public base", () => {
    expect(r2KeyFromUrl(`${PUB}/uploads/a%20b.png`)).toBe("uploads/a b.png")
  })

  // 削除側は厳密のまま。緩めると、api/ai-design/route.ts が R2 未設定の開発環境で書く
  // 相対パスが実バケットのオブジェクトへの削除に化ける（campaigns.ts 参照）
  it("returns null for a dev relative path like /uploads/<uuid>.png", () => {
    expect(r2KeyFromUrl("/uploads/123e4567-e89b-12d3-a456-426614174000.png")).toBeNull()
  })

  it("returns null for a foreign-host url with an uploads/ path", () => {
    expect(r2KeyFromUrl("https://pub-old.r2.dev/uploads/a.png")).toBeNull()
  })
})
