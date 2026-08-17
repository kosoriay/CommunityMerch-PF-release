import { describe, it, expect } from "vitest"
import { selectOrphanKeys, type R2Object } from "./orphaned-uploads"

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
