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
