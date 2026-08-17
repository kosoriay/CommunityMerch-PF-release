import { db } from "@/lib/db/client"
import { designs, platformConfig } from "@/lib/db/schema"
import { isNotNull } from "drizzle-orm"
import { r2KeyFromUrl, deleteFromR2, listR2Objects } from "@/lib/providers/r2"

/** R2 の一覧から、判定に必要な項目だけを取り出した形。 */
export type R2Object = { key: string; lastModified: Date }

/** こちらが書き込む接頭辞。ここ以外は掃除の対象にしない。 */
export const SWEPT_PREFIXES = ["uploads/", "ai-designs/"] as const

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
 * `designs.mockupUrl` と `campaignProducts.mockupUrl` は Printful のファイルを
 * 指すので入れない。`r2KeyFromUrl` が null を返すため入れても無害だが、読んだ人が
 * 「モックアップも R2 にある」と誤解する。
 *
 * `platformConfig.logoUrl` は現状 `/api/upload` を通らないが、R2 の URL を入れる
 * ことはできるので防御的に含める。
 */
export async function collectReferencedKeys(): Promise<Set<string>> {
  const keys = new Set<string>()

  const designRows = await db
    .select({ url: designs.designFileUrl })
    .from(designs)
    .where(isNotNull(designs.designFileUrl))
  for (const row of designRows) {
    const key = r2KeyFromUrl(row.url)
    if (key) keys.add(key)
  }

  const configRows = await db.select({ url: platformConfig.logoUrl }).from(platformConfig)
  for (const row of configRows) {
    const key = r2KeyFromUrl(row.url)
    if (key) keys.add(key)
  }

  return keys
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
  const referencedKeys = await collectReferencedKeys()

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
