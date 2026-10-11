import { db } from "@/lib/db/client"
import { campaignProducts, designs, platformConfig } from "@/lib/db/schema"
import { deleteFromR2, listR2Objects, r2PublicUrlOrNull } from "@/lib/providers/r2"
import { collectProtectedKeys, SWEPT_PREFIXES } from "@/lib/r2-keys"

// 定義は r2-keys.ts（依存ゼロ）。既存の import 元を壊さないよう再エクスポートする
export { SWEPT_PREFIXES }

/** R2 の一覧から、判定に必要な項目だけを取り出した形。 */
export type R2Object = { key: string; lastModified: Date }

/** これより新しいオブジェクトは、参照が無くても消さない。 */
export const GRACE_MS = 7 * 24 * 60 * 60 * 1000

/** 1回の実行で消す上限。 */
export const SWEEP_LIMIT = 200

/**
 * 削除してよいキーを選ぶ。DB も R2 も触らないので、危険な分岐を単体で試験できる。
 *
 * 参照集合が空のときに何も返さないのが、この関数のいちばん重要な性質である。空に
 * なるのは DB の読み取りが失敗したときであり、それを「全部孤児」と解釈すると
 * バケットを丸ごと消すことになる。
 */
export function selectOrphanKeys(args: {
  objects: R2Object[]
  referencedKeys: Set<string>
  now: Date
  graceMs: number
  limit: number
}): string[] {
  const { objects, referencedKeys, now, graceMs, limit } = args
  if (referencedKeys.size === 0) return []

  const cutoff = now.getTime() - graceMs
  const orphans: string[] = []

  for (const object of objects) {
    if (orphans.length >= limit) break
    if (!SWEPT_PREFIXES.some((prefix) => object.key.startsWith(prefix))) continue
    if (object.lastModified.getTime() >= cutoff) continue
    if (referencedKeys.has(object.key)) continue
    orphans.push(object.key)
  }

  return orphans
}

/**
 * いま参照されている R2 キーの集合。
 *
 * **2026-09-11 の変更（設計 §3・§8.2）:** モックアップも R2 に置くようになった。
 * `campaign_products.mockup_urls` / `.mockup_url` と `designs.mockup_url` は
 * **参照集合に入れなければならない。** 以前のコメントは「モックアップは Printful の
 * ファイルを指すので入れない」と書いていたが、それは Printful が一時置き場を
 * 返すという事実が分かる前の記述である。
 *
 * `platformConfig.logoUrl` は現状 `/api/upload` を通らないが、R2 の URL を入れる
 * ことはできるので防御的に含める。
 */
export async function collectProtectedReferences(): Promise<{
  keys: Set<string>
  pathOnlyCount: number
}> {
  const publicUrl = r2PublicUrlOrNull()

  const designRows = await db
    .select({ file: designs.designFileUrl, mockup: designs.mockupUrl })
    .from(designs)

  const productRows = await db
    .select({ one: campaignProducts.mockupUrl, many: campaignProducts.mockupUrls })
    .from(campaignProducts)

  const configRows = await db.select({ url: platformConfig.logoUrl }).from(platformConfig)

  // **「消さない」集合なので、緩い照合（collectProtectedKeys）を使う。**
  // cron の削除リストは厳密な referencedKeysFrom のまま — 取り違えると、現行バケットの
  // キーを外部URLの参照から削除してしまう
  return collectProtectedKeys(
    [
      ...designRows.flatMap((r) => [r.file, r.mockup]),
      ...productRows.flatMap((r) => [r.one, r.many]),
      ...configRows.map((r) => r.url),
    ],
    publicUrl
  )
}

/** `collectProtectedReferences` の鍵だけ。 */
export async function collectReferencedKeys(): Promise<Set<string>> {
  return (await collectProtectedReferences()).keys
}

export type SweepResult = {
  scanned: number
  orphaned: number
  deleted: number
  limitReached: boolean
  keys: string[]
}

/**
 * 参照されていない古いアップロードを回収する。
 *
 * `dryRun` を渡すと選ぶところで止め、何も削除しない。実バケットに対して「何が
 * 消えるのか」を確認するために使う。
 */
export async function sweepOrphanedUploads(
  now: Date,
  options: { dryRun?: boolean } = {}
): Promise<SweepResult> {
  const { keys: referencedKeys, pathOnlyCount } = await collectProtectedReferences()
  if (pathOnlyCount > 0) {
    // ベースが変わった形跡。黙ると、旧ベースの参照で守られているだけの状態に気づけない
    console.warn(
      `[orphan-sweep] ${pathOnlyCount} referenced key(s) matched only by path shape, not by the current CLOUDFLARE_R2_PUBLIC_URL; the base URL may have changed (the count may also include unrelated URLs)`
    )
  }

  const objects = (
    await Promise.all(SWEPT_PREFIXES.map((prefix) => listR2Objects(prefix)))
  ).flat()

  const keys = selectOrphanKeys({
    objects,
    referencedKeys,
    now,
    graceMs: GRACE_MS,
    limit: SWEEP_LIMIT,
  })

  const limitReached = keys.length >= SWEEP_LIMIT
  if (limitReached) {
    // 打ち切りを黙ると「全部処理済み」に見える
    console.warn(`[orphan-sweep] hit the ${SWEEP_LIMIT} limit; more remain for the next run`)
  }

  if (options.dryRun) {
    return { scanned: objects.length, orphaned: keys.length, deleted: 0, limitReached, keys }
  }

  const { deleted } = await deleteFromR2(keys)
  return { scanned: objects.length, orphaned: keys.length, deleted, limitReached, keys }
}
