import { describe, it, expect } from "vitest"
import {
  collectProtectedKeys, referencedKeysFrom, REQUIRED_R2_ENV_VARS, SWEPT_PREFIXES,
  uploadExtensionFor,
} from "./r2-keys"

describe("collectProtectedKeys", () => {
  const PUB = "https://pub-abc.r2.dev"
  const OLD = "https://pub-old.r2.dev"

  it("protects an old-base uploads/ url that strict matching misses — the production data-loss case", () => {
    const raw = `${OLD}/uploads/print.png`
    // 分離の錠: cron の削除リストが使う厳密関数は、旧ベースを拾ってはいけない
    expect(referencedKeysFrom([raw], PUB)).toEqual(new Set())
    const { keys, pathOnlyCount } = collectProtectedKeys([raw], PUB)
    expect(keys).toEqual(new Set(["uploads/print.png"]))
    expect(pathOnlyCount).toBe(1)
  })

  it("does not collect a key from a mid-path uploads/ segment", () => {
    expect(collectProtectedKeys(["https://h.example/a/uploads/x.png"], PUB).keys).toEqual(new Set())
  })

  it("does not collect a relative path (the dev fallback has no host)", () => {
    expect(collectProtectedKeys(["/uploads/x.png"], PUB).keys).toEqual(new Set())
  })

  it("collects ai-designs/ and mockups/ but not an unrelated first segment", () => {
    const { keys } = collectProtectedKeys(
      [`${OLD}/ai-designs/a.png`, `${OLD}/mockups/c1/b.png`, `${OLD}/other/c.png`],
      PUB
    )
    expect(keys).toEqual(new Set(["ai-designs/a.png", "mockups/c1/b.png"]))
  })

  it("counts nothing for urls on the current base", () => {
    const result = collectProtectedKeys([`${PUB}/uploads/a.png`, `${PUB}/mockups/b.png?v=1#x`], PUB)
    expect(result.pathOnlyCount).toBe(0)
    expect(result.keys.has("uploads/a.png")).toBe(true)
    expect(result.keys.has("mockups/b.png")).toBe(true)
  })

  it("counts only the keys matched by path shape alone", () => {
    const { pathOnlyCount } = collectProtectedKeys(
      [`${PUB}/uploads/a.png`, `${OLD}/uploads/b.png`, `${OLD}/uploads/a.png`],
      PUB
    )
    // b.png だけが現行ベースでは説明できない。a.png は現行ベースでも拾われている
    expect(pathOnlyCount).toBe(1)
  })

  it("still scans by path shape when R2 is not configured (protection only adds keys)", () => {
    const { keys, pathOnlyCount } = collectProtectedKeys([`${OLD}/uploads/a.png`], null)
    expect(keys).toEqual(new Set(["uploads/a.png"]))
    expect(pathOnlyCount).toBe(1)
  })

  it("keeps everything the strict function returns", () => {
    const raw = [`${PUB}/uploads/a b.png `, JSON.stringify({ Black: `${PUB}/mockups/c1/x.png` })]
    const strict = referencedKeysFrom(raw, PUB)
    const { keys } = collectProtectedKeys(raw, PUB)
    expect(strict.size).toBeGreaterThan(0)
    for (const k of strict) expect(keys.has(k)).toBe(true)
  })

  it("handles a host with a port and a trailing-dot host", () => {
    const { keys } = collectProtectedKeys(
      ["https://cdn.example:8443/uploads/a.png", "https://cdn.example./uploads/b.png"],
      PUB
    )
    expect(keys).toEqual(new Set(["uploads/a.png", "uploads/b.png"]))
  })

  it("strips a query string and a fragment, and also keeps the unstripped variant", () => {
    const { keys } = collectProtectedKeys([`${OLD}/uploads/a.png?v=2#frag`], PUB)
    expect(keys.has("uploads/a.png")).toBe(true)
    expect(keys.has("uploads/a.png?v=2#frag")).toBe(true) // 多めに拾う側（厳密関数と同じ流儀）
  })

  it("decodes an encoded slash inside the key, but does not match an encoded slash right after the prefix", () => {
    // 選択: 接頭辞の直後の %2F は一致させない（当方は ${publicUrl}/${key} を無符号で作る）。
    // キー内部の %2F は復号して集合へ入れる。多めに拾うのは安全。
    expect(collectProtectedKeys([`${OLD}/uploads/a%2Fb.png`], PUB).keys.has("uploads/a/b.png")).toBe(true)
    expect(collectProtectedKeys([`${OLD}/uploads%2Fa.png`], PUB).keys).toEqual(new Set())
  })

  it("finds urls inside a json document and stops at the closing quote", () => {
    const raw = JSON.stringify({ Black: `${OLD}/mockups/c1/a.png`, Navy: `${OLD}/mockups/c1/b.png` })
    expect(collectProtectedKeys([raw], PUB).keys).toEqual(new Set(["mockups/c1/a.png", "mockups/c1/b.png"]))
  })

  it("ignores nulls", () => {
    expect(collectProtectedKeys([null, undefined], PUB)).toEqual({ keys: new Set(), pathOnlyCount: 0 })
  })
})

describe("SWEPT_PREFIXES", () => {
  it("lists the prefixes this app writes", () => {
    expect([...SWEPT_PREFIXES]).toEqual(["uploads/", "ai-designs/", "mockups/"])
  })
})

describe("uploadExtensionFor", () => {
  const cases: [string, string, string][] = [
    ["photo.PNG", "image/png", "png"],
    ["photo.jpeg", "image/jpeg", "jpeg"],
    ["photo.jpg", "image/jpeg", "jpg"],
    ["noext", "image/png", "png"],
    ["a.", "image/webp", "webp"],
    ["a.png/../x", "image/png", "png"],
    ["a.p ng", "image/jpeg", "jpg"],
    ["a.x\"y", "image/png", "png"],
    ["a.éé", "image/png", "png"],
    ["a.画像", "image/webp", "webp"],
    ["a.pn g\n", "image/png", "png"],
    ["a.", "image/svg+xml", "svg"],
    ["x.verylongextension", "image/png", "png"],
    ["x.html", "image/png", "png"],
    ["x.svg", "image/png", "png"],
  ]
  it.each(cases)("%j with %s gives %s", (name, mime, expected) => {
    expect(uploadExtensionFor(name, mime)).toBe(expected)
  })

  it("keeps a valid extension that agrees with the mime type", () => {
    expect(uploadExtensionFor("photo.jpg", "image/jpeg")).toBe("jpg")
  })

  it("never returns anything but 1-8 lowercase alphanumerics", () => {
    for (const name of ["", ".", "..", "a.b.c", "a\u0000.png", "a.PNG ", "a/b.png"]) {
      expect(uploadExtensionFor(name, "image/png")).toMatch(/^[a-z0-9]{1,8}$/)
    }
  })

  it("fails closed to a safe value for an unknown mime type", () => {
    expect(uploadExtensionFor("a.png", "text/html")).toBe("bin")
  })
})

describe("REQUIRED_R2_ENV_VARS", () => {
  it("names the variables getR2 needs", () => {
    expect([...REQUIRED_R2_ENV_VARS].sort()).toEqual([
      "CLOUDFLARE_R2_ACCESS_KEY_ID",
      "CLOUDFLARE_R2_ACCOUNT_ID",
      "CLOUDFLARE_R2_BUCKET_NAME",
      "CLOUDFLARE_R2_PUBLIC_URL",
      "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
    ])
  })
})
