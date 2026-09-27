/**
 * Printful が報告する注文状態の分類と、それに付随する定数（設計 2026-09-21 §4）。
 *
 * **このファイルは何も import しない。** 時刻・DB・ネットワークに触らない。
 * SQL の条件（orders.ts）と TS の判定が、ここの定数だけを共有する。
 */

/** Printful 上で「進んでいる／終わった」状態。これ以外はすべて異常側（§4.1）。 */
export const PRINTFUL_HEALTHY_STATUSES = [
  "pending",
  "inreview",
  "inprocess",
  "partial",
  "fulfilled",
  "archived",
] as const

/** Printful 上の終端。定期照会の対象から外す（§5.5）。 */
export const PRINTFUL_POLLING_DONE_STATUSES = ["fulfilled", "archived", "canceled"] as const

/** 照会が 404 だったときにアプリが書く番兵値（§5.4・§5.5）。 */
export const PRINTFUL_NOT_FOUND = "not_found"

/** `printful_status_reason` と `printful_check_error` の上限（§3）。 */
export const PRINTFUL_TEXT_MAX_LENGTH = 500

/** Printful への照会1回のタイムアウト（§5.4）。 */
export const PRINTFUL_FETCH_TIMEOUT_MS = 10_000

/** 候補URLの自己検査（自己 POST）のタイムアウト（設計 §3.3）。 */
export const PRINTFUL_WEBHOOK_PROBE_TIMEOUT_MS = 5_000

/** 定期照会1回あたりの件数上限（§5.5）。レート制限 120 req/分の半分以下。 */
export const PRINTFUL_RECONCILE_BATCH_SIZE = 50

/** 定期照会1回あたりの経過時間の上限（§5.5）。 */
export const PRINTFUL_RECONCILE_TIME_BUDGET_MS = 60_000

/** 全件 404 の防御が働く最小件数（§5.5）。 */
export const PRINTFUL_NOT_FOUND_GUARD_MIN = 3

/**
 * 区分 C2 (b)：最後に確認できてからこの時間を超えたら「確認できていない」（§6.1）。
 * **PRINTFUL_RECONCILE_BATCH_SIZE と連動する。** 照会対象が
 * BATCH × (STALE_HOURS / 24) 件を超えると、正常でも C2 に出る。
 */
export const PRINTFUL_STATUS_STALE_HOURS = 48

/** 区分 B：paid になってからこの時間が経っても発注されていなければ要対応（§6.1）。 */
export const UNSUBMITTED_ORDER_ALERT_MINUTES = 30

export type PrintfulStatusClass = "unknown" | "progressing" | "in_production" | "done" | "needs_action"

/**
 * §4.2。**未知の文字列は needs_action に入る**（fail-closed）。
 * 異常を「異常な値の一覧」で書かないこと。
 */
export function classifyPrintfulStatus(status: string | null): PrintfulStatusClass {
  if (status === null) return "unknown"
  switch (status) {
    case "pending":
    case "inreview":
      return "progressing"
    case "inprocess":
    case "partial":
      return "in_production"
    case "fulfilled":
    case "archived":
      return "done"
    default:
      return "needs_action"
  }
}

/**
 * §4.3。needs_action なら通知する。ただし draft は自動確定の運用のときだけ。
 * 手動確定（PRINTFUL_AUTO_CONFIRM=false）では全注文が draft で届くので画面にだけ出す。
 */
export function shouldAlertPrintfulStatus(status: string | null, autoConfirm: boolean): boolean {
  if (classifyPrintfulStatus(status) !== "needs_action") return false
  if (status === "draft") return autoConfirm
  return true
}

/** webhook の種類と、照会し直した状態の対応（§5.4 手順4）。 */
const REASON_EVENT_STATUS: Record<string, string> = {
  order_failed: "failed",
  order_canceled: "canceled",
  order_put_hold: "onhold",
  order_put_hold_approval: "onhold",
}

/**
 * webhook の `data.reason` を記録してよいか。イベントの種類と照会結果の状態が
 * 一致するときだけ理由を返す。それ以外は null（偽の payload が理由の文言を
 * 書き込めるのは、照会結果と一致したときだけになる）。
 */
export function reasonForObservation(
  eventType: string,
  observedStatus: string,
  reason: unknown
): string | null {
  if (typeof reason !== "string" || reason.trim() === "") return null
  if (REASON_EVENT_STATUS[eventType] !== observedStatus) return null
  return truncatePrintfulText(reason)
}

/** §3。500 文字で切る。 */
export function truncatePrintfulText(text: string): string {
  return text.length > PRINTFUL_TEXT_MAX_LENGTH ? text.slice(0, PRINTFUL_TEXT_MAX_LENGTH) : text
}

/**
 * 区分 C1 の直し方（§6.2）。管理画面と運営者へのメールで同じ文言を使う。
 * 英語（UI の言語）。
 */
export function printfulFixGuidance(status: string): string {
  switch (status) {
    case "failed":
      return "Check that a payment method is set up in Printful (Billing → Payment methods), then confirm this order again in Printful's Orders. If you refund instead of fixing it, cancel the order in Printful first — failed orders are printed if they are approved later."
    case "onhold":
      return "Open this order in Printful's Orders, read why it is on hold, and follow the instructions there. If you refund instead, cancel the order in Printful first."
    case "canceled":
      return "Printful canceled this order. Consider refunding the buyer from this order's page."
    case "draft":
      return "Nothing is printed until you press Confirm on this order in Printful's Orders. If you refund instead of confirming, cancel the order in Printful first."
    case PRINTFUL_NOT_FOUND:
      return "Printful has no order for this reference. Check Printful's Orders."
    default:
      return "Printful reported a status this app does not recognise. Check the order in Printful's Orders."
  }
}

/**
 * 区分 C2 の説明（§6.1）。確認に失敗した記録があれば (a)、無ければ (b)。
 */
export function printfulUncheckedGuidance(checkError: string | null): string {
  return checkError
    ? `Could not confirm this order with Printful: ${checkError}. This usually clears on Printful's retry or the next daily check. If it does not, suspect an expired Printful API token.`
    : "Printful's status for this order has not been checked for a while. Make sure the daily check (00:00 UTC) is running."
}

/**
 * Printful webhook で有効化すべき9種類（設計 2026-09-22 §3.1）。
 * route.ts の STATUS_EVENTS（状態系6種）+ 個別処理される3種類
 * （package_shipped / order_refunded / package_returned）。
 * ここを変更したら route.ts 側の STATUS_EVENTS の導出も合わせて見直すこと
 * （filter で除外しているだけなので通常は自動的に追従する）。
 */
export const PRINTFUL_WEBHOOK_EVENT_TYPES = [
  "package_shipped",
  "order_refunded",
  "package_returned",
  "order_failed",
  "order_canceled",
  "order_put_hold",
  "order_put_hold_approval",
  "order_remove_hold",
  "order_updated",
] as const

/**
 * route.ts の「9 = 6 (状態系) + 3 (個別処理)」の分割が壊れていないかを検査する
 * （レビュー指摘・設計§9のfail-closed要件）。壊れていれば理由を、壊れていなければ
 * null を返す純粋関数。route.ts はこれをモジュール読み込み時に呼び、違反時は throw する。
 *
 * 2つを検査する:
 * 1. `individuallyHandled` の全要素が `allTypes`（正本の9件）に実在するか。
 *    実在しない要素があると、その分だけ `statusEvents` が本来より多くなり
 *    （filter が除外し損ねる）、しかも route.ts の明示的な if 分岐が本物の
 *    イベントを先に横取りするため、実行時にもテストにも現れず検出できない。
 * 2. `statusEvents.size + individuallyHandled.size` が `allTypes.length` と
 *    一致するか。typo で6種類のどれかを誤って `individuallyHandled` 側に
 *    含めてしまうと、この和が9件を下回る。
 */
export function checkWebhookEventSplitInvariant(
  allTypes: readonly string[],
  individuallyHandled: ReadonlySet<string>,
  statusEvents: ReadonlySet<string>
): string | null {
  const known = new Set(allTypes)
  for (const eventType of individuallyHandled) {
    if (!known.has(eventType)) {
      return `"${eventType}" is not one of the ${allTypes.length} documented Printful webhook event types`
    }
  }
  if (statusEvents.size + individuallyHandled.size !== allTypes.length) {
    return (
      `status events (${statusEvents.size}) + individually-handled events (${individuallyHandled.size}) ` +
      `!== the documented total (${allTypes.length})`
    )
  }
  return null
}
