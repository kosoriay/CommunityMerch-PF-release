import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/db/client", () => ({ db: { select: vi.fn() } }))
vi.mock("@/lib/providers/r2", () => ({
  r2PublicUrlOrNull: vi.fn(() => "https://pub-abc.r2.dev"),
  deleteFromR2: vi.fn().mockResolvedValue({ deleted: 0, failed: 0 }),
  listR2Objects: vi.fn().mockResolvedValue([]),
}))

import {
  selectOrphanKeys, collectReferencedKeys, SWEPT_PREFIXES, type R2Object,
} from "./orphaned-uploads"
import { referencedKeysFrom } from "./r2-keys"
import { db } from "@/lib/db/client"
import { r2PublicUrlOrNull } from "@/lib/providers/r2"

const NOW = new Date("2026-08-16T12:00:00Z")
const DAY = 86_400_000
const GRACE = 7 * DAY

/** `days` 日前に作られたオブジェクト。 */
function obj(key: string, days: number): R2Object {
  return { key, lastModified: new Date(NOW.getTime() - days * DAY) }
}

const base = { now: NOW, graceMs: GRACE, limit: 200 }
const LIVE = new Set(["uploads/live.png"])

describe("selectOrphanKeys", () => {
  it("should select an old, unreferenced object", () => {
    const objects = [obj("uploads/a.png", 10)]
    expect(selectOrphanKeys({ ...base, objects, referencedKeys: LIVE })).toEqual(["uploads/a.png"])
  })

  it("should never select a referenced object", () => {
    const objects = [obj("uploads/live.png", 100)]
    expect(selectOrphanKeys({ ...base, objects, referencedKeys: LIVE })).toEqual([])
  })

  it("should never select an object inside the grace period", () => {
    // アップロード済み・保存前のファイル。参照が無いのは当然で、消してはいけない
    const objects = [obj("uploads/fresh.png", 1)]
    expect(selectOrphanKeys({ ...base, objects, referencedKeys: LIVE })).toEqual([])
  })

  it("should treat exactly the grace boundary as still protected", () => {
    const objects = [{ key: "uploads/edge.png", lastModified: new Date(NOW.getTime() - GRACE) }]
    expect(selectOrphanKeys({ ...base, objects, referencedKeys: LIVE })).toEqual([])
  })

  it("should select one millisecond past the grace boundary", () => {
    const objects = [{ key: "uploads/edge.png", lastModified: new Date(NOW.getTime() - GRACE - 1) }]
    expect(selectOrphanKeys({ ...base, objects, referencedKeys: LIVE })).toEqual(["uploads/edge.png"])
  })

  it("should select nothing when the referenced set is empty", () => {
    // 参照集合が空になるのは、DB の読み取りが失敗したときである。
    // それを「全部孤児」と解釈すると、バケットを丸ごと消す。
    const objects = [obj("uploads/a.png", 100), obj("ai-designs/b.png", 100)]
    expect(selectOrphanKeys({ ...base, objects, referencedKeys: new Set() })).toEqual([])
  })

  it("should stop at the limit", () => {
    const objects = Array.from({ length: 5 }, (_, i) => obj(`uploads/${i}.png`, 10))
    const result = selectOrphanKeys({ ...base, objects, referencedKeys: LIVE, limit: 3 })
    expect(result).toHaveLength(3)
  })

  it("should cover both swept prefixes", () => {
    const objects = [obj("uploads/a.png", 10), obj("ai-designs/b.png", 10)]
    const result = selectOrphanKeys({ ...base, objects, referencedKeys: LIVE })
    expect(result).toEqual(["uploads/a.png", "ai-designs/b.png"])
  })

  it("should ignore anything outside the swept prefixes", () => {
    // 将来このバケットに別用途のファイルが置かれても巻き込まない
    const objects = [obj("exports/report.csv", 100), obj("uploads/a.png", 10)]
    const result = selectOrphanKeys({ ...base, objects, referencedKeys: LIVE })
    expect(result).toEqual(["uploads/a.png"])
  })
})

describe("the mockups prefix", () => {
  const PUB = "https://pub-abc.r2.dev"

  it("is swept", () => {
    expect(SWEPT_PREFIXES).toContain("mockups/")
  })

  it("never selects a mockup that a campaign_products row still points at", () => {
    // 参照集合に入っているキーが選ばれないことの確認。**参照元が1つ落ちていないか
    // は、ここでは見ていない** — 参照集合を手で組み立てているので、
    // collectReferencedKeys から campaignProducts の問い合わせを消してもここは緑の
    // ままである。§8.2 の番人は下の collectReferencedKeys の試験のほう。
    const raw = JSON.stringify({ Black: `${PUB}/mockups/c1/live.png` })
    const referencedKeys = referencedKeysFrom([raw], PUB)
    const objects: R2Object[] = [
      { key: "mockups/c1/live.png", lastModified: new Date(NOW.getTime() - 100 * DAY) },
    ]
    expect(selectOrphanKeys({ ...base, objects, referencedKeys })).toEqual([])
  })

  it("does select a mockup that nothing points at — the contrast case", () => {
    // 対照。描画・参照がまるごと壊れたときに上のテストが空振りで通るのを防ぐ
    const raw = JSON.stringify({ Black: `${PUB}/mockups/c1/live.png` })
    const referencedKeys = referencedKeysFrom([raw], PUB)
    const objects: R2Object[] = [
      { key: "mockups/c1/superseded.png", lastModified: new Date(NOW.getTime() - 100 * DAY) },
    ]
    expect(selectOrphanKeys({ ...base, objects, referencedKeys })).toEqual(["mockups/c1/superseded.png"])
  })
})

/**
 * §8.2 / §13 T3 の番人。**参照元を1つ落とすと生きている画像が7日後に消える。**
 *
 * 5つの列に**別々の**キーを置く。実際の行では代表色URLが `mockup_url` と
 * `mockup_urls` の両方に入るが、重ねてしまうと片方の列を落としても赤くならない。
 */
describe("collectReferencedKeys", () => {
  const PUB = "https://pub-abc.r2.dev"

  const DESIGN_FILE = "uploads/print-file.png"        // designs.design_file_url
  const DESIGN_MOCKUP = "mockups/design-previews/hero.png" // designs.mockup_url
  const PRODUCT_ONE = "mockups/c1/black.png"          // campaign_products.mockup_url
  const PRODUCT_MANY = "mockups/c1/navy.png"          // campaign_products.mockup_urls
  const LOGO = "uploads/logo.png"                     // platform_config.logo_url

  /** `db.select().from(...)` を経路ごとに1つずつ積む。 */
  function armRows() {
    vi.mocked(r2PublicUrlOrNull).mockReturnValue(PUB)
    vi.mocked(db.select)
      .mockReturnValueOnce({
        from: vi.fn().mockResolvedValue([
          { file: `${PUB}/${DESIGN_FILE}`, mockup: `${PUB}/${DESIGN_MOCKUP}` },
        ]),
      } as never)
      .mockReturnValueOnce({
        from: vi.fn().mockResolvedValue([
          {
            one: `${PUB}/${PRODUCT_ONE}`,
            many: JSON.stringify({ Navy: `${PUB}/${PRODUCT_MANY}` }),
          },
        ]),
      } as never)
      .mockReturnValueOnce({
        from: vi.fn().mockResolvedValue([{ url: `${PUB}/${LOGO}` }]),
      } as never)
  }

  beforeEach(() => {
    // resetAllMocks。消費されずに残った mockReturnValueOnce のキューは
    // clearAllMocks では次のテストへ持ち越される
    vi.resetAllMocks()
  })

  it("collects keys from all five referencing columns", async () => {
    armRows()
    const keys = await collectReferencedKeys()

    // 列ごとに1つずつ。どれが欠けたのかが失敗メッセージで分かる
    expect(keys.has(DESIGN_FILE)).toBe(true)      // 印刷用ファイル。消えると注文が止まる
    expect(keys.has(DESIGN_MOCKUP)).toBe(true)
    expect(keys.has(PRODUCT_ONE)).toBe(true)
    expect(keys.has(PRODUCT_MANY)).toBe(true)
    expect(keys.has(LOGO)).toBe(true)
    // 余分も不足も許さない。列を1つ落とせばここも赤くなる
    expect(keys).toEqual(new Set([
      DESIGN_FILE, DESIGN_MOCKUP, PRODUCT_ONE, PRODUCT_MANY, LOGO,
    ]))
  })

  it("does not collect a key that no row points at", async () => {
    // 対照。参照集合が「何でも含む」ものになっていたら、上のテストは空振りで通る
    armRows()
    const keys = await collectReferencedKeys()
    expect(keys.has("mockups/c1/superseded.png")).toBe(false)
  })

  it("returns an empty set when R2 is not configured, instead of throwing", async () => {
    // 開発環境でも掃除全体は走る。ここで例外が出ると cron が止まる
    vi.mocked(r2PublicUrlOrNull).mockReturnValue(null)
    vi.mocked(db.select)
      .mockReturnValueOnce({ from: vi.fn().mockResolvedValue([]) } as never)
      .mockReturnValueOnce({ from: vi.fn().mockResolvedValue([]) } as never)
      .mockReturnValueOnce({ from: vi.fn().mockResolvedValue([]) } as never)

    expect(await collectReferencedKeys()).toEqual(new Set())
  })
})
