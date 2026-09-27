import {
  getReconcileTargets,
  countReconcileTargets,
  recordPrintfulObservation,
  recordPrintfulCheckFailure,
  claimPrintfulAlert,
  releasePrintfulAlertClaims,
  type PrintfulAlertClaim,
} from "@/lib/orders"
import { getPrintfulOrder, isPrintfulAutoConfirm } from "@/lib/providers/printful"
import { toPrintfulExternalId } from "@/lib/printful-ids"
import { alertPrintfulStatusProblems } from "@/lib/fulfillment-alerts"
import {
  PRINTFUL_NOT_FOUND,
  PRINTFUL_NOT_FOUND_GUARD_MIN,
  PRINTFUL_RECONCILE_BATCH_SIZE,
  PRINTFUL_RECONCILE_TIME_BUDGET_MS,
  PRINTFUL_STATUS_STALE_HOURS,
} from "@/lib/printful-status"
import type { WebhookSyncResult } from "@/lib/printful-webhook-sync"

export const RECONCILE_AUTH_NOTE =
  "Printful rejected the status check with an authorization error — suspect an expired Printful API token."
export const RECONCILE_WRONG_STORE_NOTE =
  "Printful had none of the orders it was asked about. The Printful API token may point at a different store. Nothing was recorded."
const RECONCILE_SOURCE = "reconcile"

/**
 * C2(b) の容量警告の文言（最終レビュー指摘）。以前は `console.warn` にしか出ておらず、
 * 運営者はダッシュボードか cron のログを見ない限り知りようがなかった。ダイジェストの
 * `notes` にも同じ文言を載せる。
 */
export function capacityWarningNote(targetCount: number, capacity: number): string {
  return `${targetCount} orders need a Printful status check, but only ${capacity} fit within ${PRINTFUL_STATUS_STALE_HOURS}h at the current batch size — some healthy orders will show as unchecked. Consider raising PRINTFUL_RECONCILE_BATCH_SIZE.`
}

/**
 * webhook 登録確認（Task 6・registerPrintfulWebhooksIfNeeded）の結果を、要注意
 * なものだけ人間向けの一言に変換する（設計 §3.6・§3.7）。
 * `reconcilePrintfulStatuses` のシグネチャは変えず、cron ルート側がこの note を
 * `alertPrintfulStatusProblems([], notes)` で独立して送るために使う（C11 の
 * 「claims と notes が両方空なら no-op」という性質を利用し、新しい通知経路・
 * テンプレートは増やさない）。
 */
const WEBHOOK_SYNC_ALERT_NOTE: Record<string, (r: Extract<WebhookSyncResult, { kind: "unauthorized" | "register_failed" }> | { error: string }) => string> = {
  unauthorized: (r) => `Printful webhook registration could not be checked: the API token is missing the webhook scopes (View / manage store webhooks). See 00-START-HERE.md §4-3 for a scoped token that does not touch order fulfillment.`,
  register_failed: (r) => `Printful webhook registration failed: ${"message" in r ? r.message : ""}.`,
}

/**
 * `skipped` のうち、通知しない2種類（設計 §3.6・D7）。
 * - env 未設定: Printful 連携そのものを使っていない環境の想定内スキップ
 * - PRINTFUL_WEBHOOK_AUTO_REGISTER=false: フォークが独自の webhook 運用をする
 *   ための意図的なオプトアウト（D7）であり、「問題」ではない
 *
 * これ以外の skipped（"could not check current registration: ..." や
 * "candidate URL did not answer as this app's webhook route" を含む）は、
 * この機能が本来検知すべき核心のケースなので通知する（最終レビュー指摘 —
 * 当初の実装はここを一律で握りつぶしていた）。
 */
function isExpectedSkip(reason: string): boolean {
  return reason.startsWith("missing environment variable(s):") ||
    reason === "disabled by PRINTFUL_WEBHOOK_AUTO_REGISTER=false"
}

export function webhookSyncAlertNote(result: WebhookSyncResult | { error: string }): string | null {
  if ("error" in result) return `Printful webhook registration check threw: ${result.error}.`
  if (result.kind === "unauthorized") return WEBHOOK_SYNC_ALERT_NOTE.unauthorized(result)
  if (result.kind === "register_failed") return WEBHOOK_SYNC_ALERT_NOTE.register_failed(result)
  if (result.kind === "skipped" && !isExpectedSkip(result.reason)) {
    return `Printful webhook registration was skipped and needs attention: ${result.reason}.`
  }
  return null // up_to_date / registered / skipped(env未設定・kill-switch) は通知しない（設計 §3.6・C11・D7）
}

export type ReconcileStop = "done" | "batch_limit" | "time_budget" | "rate_limited" | "unauthorized"

export type ReconcileResult = {
  targets: number
  queried: number
  changed: number
  failed: number
  alerted: number
  stoppedBy: ReconcileStop
  notFoundGuardTripped: boolean
}

/**
 * 毎日の定期照会（設計 §5.5）。webhook が届かなくても、Printful 側の失敗を最大約24時間で拾う。
 *
 * - 対象は orders.ts の reconcileTargetCondition（fulfilled で、終端でないか、確認の失敗が残るもの）
 * - 429 は打ち切る（確認の失敗としては記録しない）。401/403 は記録して打ち切る
 * - 全件 404 は「トークンが別のストア」を疑い、not_found を書かない
 * - 異常はまとめて1通
 *
 * `clock` は経過時間の上限を試すためだけにある。
 */
export async function reconcilePrintfulStatuses(
  now: Date,
  options: { clock?: () => number } = {}
): Promise<ReconcileResult> {
  const clock = options.clock ?? Date.now
  const startedAt = clock()
  const autoConfirm = isPrintfulAutoConfirm()
  const notes: string[] = []

  const targetCount = await countReconcileTargets()
  const capacity = PRINTFUL_RECONCILE_BATCH_SIZE * (PRINTFUL_STATUS_STALE_HOURS / 24)
  if (targetCount > capacity) {
    const note = capacityWarningNote(targetCount, capacity)
    console.warn(`[printful-reconcile] ${note}`)
    notes.push(note)
  }

  const targets = await getReconcileTargets(PRINTFUL_RECONCILE_BATCH_SIZE)
  const claims: PrintfulAlertClaim[] = []
  const notFound: string[] = []
  let queried = 0
  let answered = 0
  let changed = 0
  let failed = 0
  let stoppedBy: ReconcileStop = "done"

  for (const { id } of targets) {
    if (clock() - startedAt > PRINTFUL_RECONCILE_TIME_BUDGET_MS) {
      stoppedBy = "time_budget"
      break
    }
    const lookup = await getPrintfulOrder(toPrintfulExternalId(id))
    queried++

    if (lookup.kind === "rate_limited") {
      stoppedBy = "rate_limited"
      break
    }
    if (lookup.kind === "unauthorized") {
      await recordPrintfulCheckFailure(id, RECONCILE_SOURCE, `HTTP ${lookup.httpStatus}`, now)
      failed++
      notes.push(RECONCILE_AUTH_NOTE)
      stoppedBy = "unauthorized"
      break
    }
    if (lookup.kind === "error") {
      await recordPrintfulCheckFailure(id, RECONCILE_SOURCE, lookup.message, now)
      failed++
      continue
    }
    if (lookup.kind === "not_found") {
      // 全件 404 かどうかは最後まで見ないと分からない。いったん保留する
      notFound.push(id)
      answered++
      continue
    }

    answered++
    const result = await recordPrintfulObservation(
      id,
      { status: lookup.order.status, updated: lookup.order.updated },
      null,
      RECONCILE_SOURCE,
      now
    )
    if (result.changed) changed++
    const claim = await claimPrintfulAlert(id, autoConfirm)
    if (claim) claims.push(claim)
  }

  // **答えが返ってきた件数**（404 か found）だけで判定する。`queried` は 429/401/5xx 等の
  // 失敗も数えるので、それを分母にすると1件のエラーが混ざるだけで全件404の防御が
  // 働かなくなる — 誤った店舗のトークンで49件が not_found として書かれてしまう
  // （最終レビュー指摘）。
  const notFoundGuardTripped = answered >= PRINTFUL_NOT_FOUND_GUARD_MIN && notFound.length === answered
  if (notFoundGuardTripped) {
    notes.push(RECONCILE_WRONG_STORE_NOTE)
  } else {
    for (const id of notFound) {
      const result = await recordPrintfulObservation(id, { status: PRINTFUL_NOT_FOUND, updated: null }, null, RECONCILE_SOURCE, now)
      if (result.changed) changed++
      const claim = await claimPrintfulAlert(id, autoConfirm)
      if (claim) claims.push(claim)
    }
  }

  if (stoppedBy === "done" && targetCount > targets.length) stoppedBy = "batch_limit"

  // 権利（claimPrintfulAlert）はダイジェストを送る前、ループの中で取っている。送信が
  // 失敗すると、権利は取られたままなのに誰にも届かない — 次回はもう通知されない
  // （最終レビュー指摘）。送れなかった分だけ権利を返し、次回の照会でもう一度通知させる。
  const alerted = await alertPrintfulStatusProblems(claims, notes)
  if (!alerted && claims.length > 0) {
    // claim ごとに「まだこの回が取った状態のままか」を確かめてから戻す
    // （orders.ts の releasePrintfulAlertClaims 🔴 訂正）。
    await releasePrintfulAlertClaims(claims)
  }

  const result: ReconcileResult = {
    targets: targetCount,
    queried,
    changed,
    failed,
    alerted: claims.length,
    stoppedBy,
    notFoundGuardTripped,
  }
  console.log("[printful-reconcile]", JSON.stringify(result))
  return result
}
