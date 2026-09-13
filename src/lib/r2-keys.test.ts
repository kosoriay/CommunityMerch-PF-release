import { describe, it, expect } from "vitest"
import {
  acceptableMockupUrl, needsRehost, referencedKeysFrom, resolveStoredMockupUrl,
} from "./r2-keys"

describe("acceptableMockupUrl", () => {
  const PUB = "https://pub-abc.r2.dev"

  it("accepts our own host", () => {
    expect(acceptableMockupUrl(`${PUB}/mockups/design-previews/a.png`, PUB)).toBe(true)
  })

  it("rejects a url on any other host", () => {
    // クライアントが任意のURLを保存できてはいけない。保存されたら img src として描画される
    expect(acceptableMockupUrl("https://evil.example/x.png", PUB)).toBe(false)
  })

  it("rejects a host that merely starts with our public url", () => {
    expect(acceptableMockupUrl(`${PUB}.evil.example/x.png`, PUB)).toBe(false)
  })

  it("accepts null — no preview is a valid state", () => {
    expect(acceptableMockupUrl(null, PUB)).toBe(true)
  })

  it("accepts anything when R2 is not configured, so dev keeps working", () => {
    expect(acceptableMockupUrl("https://printful-upload.example/tmp/a.png", null)).toBe(true)
  })
})

describe("resolveStoredMockupUrl", () => {
  const PUB = "https://pub-abc.r2.dev"
  const MINE = `${PUB}/mockups/design-previews/new.png`
  const OLD_MINE = `${PUB}/mockups/design-previews/old.png`
  const ROTTEN = "https://printful-upload.s3-accelerate.amazonaws.com/tmp/a/b.png"

  it("takes an acceptable incoming url over the stored one", () => {
    expect(resolveStoredMockupUrl(MINE, OLD_MINE, PUB)).toBe(MINE)
  })

  it("keeps the stored url when the incoming one is not storable", () => {
    expect(resolveStoredMockupUrl(ROTTEN, OLD_MINE, PUB)).toBe(OLD_MINE)
  })

  it("clears the column when neither url is storable", () => {
    // レビュー C1 の本体。フォームは腐った既存値を hidden で送り返してくるので、
    // 実際に来るのはこの形（incoming === existing === Printful の一時URL）である。
    // ここで existing を残すと、壊れた画像が永久に直らない。
    expect(resolveStoredMockupUrl(ROTTEN, ROTTEN, PUB)).toBeNull()
  })

  it("keeps the stored url when nothing is submitted", () => {
    expect(resolveStoredMockupUrl(null, OLD_MINE, PUB)).toBe(OLD_MINE)
  })

  it("clears a rotten stored url even when nothing is submitted", () => {
    expect(resolveStoredMockupUrl(null, ROTTEN, PUB)).toBeNull()
  })

  it("is null when there is nothing at all", () => {
    expect(resolveStoredMockupUrl(null, null, PUB)).toBeNull()
  })

  it("passes everything through when R2 is not configured, so dev keeps working", () => {
    expect(resolveStoredMockupUrl(ROTTEN, null, null)).toBe(ROTTEN)
    expect(resolveStoredMockupUrl(null, ROTTEN, null)).toBe(ROTTEN)
  })
})

describe("needsRehost", () => {
  const PUB = "https://pub-abc.r2.dev"

  it("is false when every url is on our own host", () => {
    expect(needsRehost(JSON.stringify({ Black: `${PUB}/mockups/a.png` }), PUB)).toBe(false)
  })

  it("is true when any url is still on Printful's temporary bucket", () => {
    const urls = JSON.stringify({
      Black: `${PUB}/mockups/a.png`,
      Navy: "https://printful-upload.s3-accelerate.amazonaws.com/tmp/x/y.png",
    })
    expect(needsRehost(urls, PUB)).toBe(true)
  })

  it("is true for malformed json — it falls towards regenerating", () => {
    expect(needsRehost("{not json", PUB)).toBe(true)
  })

  it("is true for an empty object", () => {
    expect(needsRehost("{}", PUB)).toBe(true)
  })

  it("is false when the column is null — that is branch 4's job, not branch 2's", () => {
    expect(needsRehost(null, PUB)).toBe(false)
  })

  it("is false when R2 is not configured, so a dev environment is not regenerated nightly", () => {
    expect(needsRehost(JSON.stringify({ Black: "https://printful-upload.example/tmp/a.png" }), null)).toBe(false)
  })

  it("does not accept a host that merely starts with our public url", () => {
    expect(needsRehost(JSON.stringify({ Black: `${PUB}.evil.example/mockups/a.png` }), PUB)).toBe(true)
  })
})

describe("referencedKeysFrom", () => {
  const PUB = "https://pub-abc.r2.dev"

  it("pulls every url out of a mockup_urls json blob", () => {
    const raw = JSON.stringify({ Black: `${PUB}/mockups/c1/a.png`, Navy: `${PUB}/mockups/c1/b.png` })
    expect(referencedKeysFrom([raw], PUB)).toEqual(new Set(["mockups/c1/a.png", "mockups/c1/b.png"]))
  })

  it("still finds the urls when the json is broken", () => {
    // 取りこぼすと生きた画像を消すので、JSON.parse に頼らない
    const raw = `{"Black":"${PUB}/mockups/c1/a.png","Navy":`
    expect(referencedKeysFrom([raw], PUB)).toEqual(new Set(["mockups/c1/a.png"]))
  })

  it("handles a plain single url column", () => {
    expect(referencedKeysFrom([`${PUB}/uploads/d.png`], PUB)).toEqual(new Set(["uploads/d.png"]))
  })

  it("ignores urls on other hosts", () => {
    const raw = JSON.stringify({ Black: "https://printful-upload.example/tmp/a.png" })
    expect(referencedKeysFrom([raw], PUB)).toEqual(new Set())
  })

  it("ignores nulls and returns an empty set when R2 is not configured", () => {
    expect(referencedKeysFrom([null, undefined, `${PUB}/uploads/d.png`], null)).toEqual(new Set())
  })

  it("decodes percent-encoded keys", () => {
    expect(referencedKeysFrom([`${PUB}/mockups/c1/a%20b.png`], PUB)).toEqual(new Set(["mockups/c1/a b.png"]))
  })

  it("does not treat dots in the public url as wildcards", () => {
    const PUB = "https://pub-abc.r2.dev"
    expect(referencedKeysFrom(["https://pub-abcXr2Ydev/mockups/a.png"], PUB)).toEqual(new Set())
  })

  it("works when the public url contains an underscore (the LIKE hazard)", () => {
    const PUB = "https://pub_abc.r2.dev"
    expect(referencedKeysFrom([`${PUB}/mockups/a.png`], PUB)).toEqual(new Set(["mockups/a.png"]))
  })

  it("recovers the whole key when the filename contains a space", () => {
    // `api/upload/route.ts` はキーの末尾に**利用者のファイル名の拡張子**をそのまま
    // 入れ、符号化しない。空白で切ると参照集合から漏れ、生きている印刷用ファイルが
    // 7日後に消える（レビュー I4）
    const raw = JSON.stringify({ Black: `${PUB}/uploads/abc-123.my design` })
    expect(referencedKeysFrom([raw], PUB)).toEqual(new Set(["uploads/abc-123.my design"]))
  })

  it("recovers the whole key when the filename contains an apostrophe", () => {
    const raw = JSON.stringify({ Black: `${PUB}/uploads/abc-123.kid's art` })
    expect(referencedKeysFrom([raw], PUB)).toEqual(new Set(["uploads/abc-123.kid's art"]))
  })

  it("still splits two keys in one json blob, now that quotes are the only stop", () => {
    // 空白を許した代償を見る。JSON では必ず `"` が来るので、隣の色まで飲み込まない
    const raw = JSON.stringify({ Black: `${PUB}/mockups/a.png`, Navy: `${PUB}/mockups/b.png` })
    expect(referencedKeysFrom([raw], PUB)).toEqual(new Set(["mockups/a.png", "mockups/b.png"]))
  })

  it("keeps both the raw and trimmed form when the captured text has whitespace that is not part of the key", () => {
    // ここでは末尾の改行はキー本体ではない付随物だが、どちらが正しいかは判定
    // できないので trim 前後の両方を集合に入れる（多めに拾う側が安全）
    expect(referencedKeysFrom([`${PUB}/uploads/d.png\n`], PUB)).toEqual(
      new Set(["uploads/d.png", "uploads/d.png\n"])
    )
  })

  it("keeps the untrimmed key when the filename itself ends in a space", () => {
    // `api/upload/route.ts` は `file.name.split(".").pop()` をそのまま拡張子に使う
    // ため、`logo.png ` のような末尾に空白を含むファイル名から、実際に空白で終わる
    // R2 キーが作られる。ここで trim すると参照集合には存在しないキーになり、
    // 実在する生きたオブジェクトが7日後に掃除で消される。
    const raw = JSON.stringify({ Black: `${PUB}/uploads/abc.png ` })
    const result = referencedKeysFrom([raw], PUB)
    expect(result.has("uploads/abc.png ")).toBe(true)
  })

  it("also keeps the trimmed key alongside it, since it may be the real one", () => {
    const raw = JSON.stringify({ Black: `${PUB}/uploads/abc.png ` })
    const result = referencedKeysFrom([raw], PUB)
    expect(result.has("uploads/abc.png")).toBe(true)
  })

  it("survives a malformed percent sequence without dropping the key", () => {
    // 落とすと生きている画像が孤児と判定される。拾えないより生の値で拾う
    const PUB = "https://pub-abc.r2.dev"
    expect(referencedKeysFrom([`${PUB}/mockups/c1/a%ZZ.png`], PUB)).toEqual(new Set(["mockups/c1/a%ZZ.png"]))
  })
})
