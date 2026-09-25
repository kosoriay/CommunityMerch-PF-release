import { PRINTFUL_NOT_FOUND } from "@/lib/printful-status"

/**
 * Order statuses that represent money the platform actually kept.
 *
 * `pending` is a checkout that was started and may never have been paid.
 * `refunded` is money that has gone back to the buyer.
 * Everything between — paid, fulfilled, shipped, delivered — is real revenue
 * and must all be counted: an order does not stop being revenue because it
 * progressed to fulfilment.
 *
 * Every revenue or order-count aggregate must filter on this list, so that
 * adding a future status forces a decision here rather than silently changing
 * reported figures.
 */
export const REVENUE_ORDER_STATUSES = [
  "paid",
  "fulfilled",
  "shipped",
  "delivered",
] as const

export type RevenueOrderStatus = (typeof REVENUE_ORDER_STATUSES)[number]

/** Statuses a refund may be issued from — the buyer has paid and not been refunded. */
export const REFUNDABLE_ORDER_STATUSES = REVENUE_ORDER_STATUSES

export function isRefundable(status: string): boolean {
  return (REFUNDABLE_ORDER_STATUSES as readonly string[]).includes(status)
}

export function countsAsRevenue(status: string): boolean {
  return (REVENUE_ORDER_STATUSES as readonly string[]).includes(status)
}

/**
 * 返金パネルに「先に Printful で取り消す」を出すか（設計 2026-09-21 §6.4・D8）。
 *
 * アプリの返金は Stripe で買い手にお金を戻すだけで、Printful の注文には何もしない。
 * 未発送の注文を先に返金すると、Printful はそのまま製造・発送し、製造費を請求する。
 * Printful に届いていない注文・発送済み・Printful 上で取消済みには出さない。
 *
 * 🔴 訂正（最終レビュー・2026-09-22）：`printful_status = not_found`（Printful に該当注文が
 * 無い）でも警告していた。無い注文を「先に Printful で取り消せ」と言うのは矛盾している
 * ので、`not_found` にも出さない。生の文字列 `"not_found"` を新たに埋め込まず、
 * `PRINTFUL_NOT_FOUND` 定数（printful-status.ts）を参照する。
 */
export function shouldWarnCancelInPrintfulFirst(order: {
  status: string
  printfulOrderId: string | null
  printfulStatus: string | null
}): boolean {
  if (order.status !== "paid" && order.status !== "fulfilled") return false
  if (!order.printfulOrderId) return false
  if (order.printfulStatus === PRINTFUL_NOT_FOUND) return false
  return order.printfulStatus !== "canceled"
}

/**
 * 注文詳細の Retry（RecoveryPanel）に出す文言（設計 2026-09-21 §6.3）。null ならリトライを出さない。
 *
 * **`status === 'paid'` のときだけ**意味を持つ。以前は `fulfillment_error` の有無だけで
 * 出していたため、返金済みの注文に古い `fulfillment_error` が残っていると返金後も
 * リトライが出ていた（このガードはその回帰の修正そのもの）。`fulfilled` 以降
 * （区分 C1/C2 を含む）は PrintfulStatusPanel が担当するので、ここでは出さない。
 *
 * `attention` は区分 B（未発注）かどうかの判定結果（`getOrderAttentionCategory` の戻り値）
 * をそのまま渡す。時間の比較（`paid_at` と `UNSUBMITTED_ORDER_ALERT_MINUTES`）は
 * `orders.ts` の `attentionConditions` にしか書かない設計（SQL と TS で二重に書かない）
 * ので、ここでは再実装せず、すでに判定済みの区分を受け取るだけにする。
 */
export function recoveryMessageForOrder(
  order: { status: string; fulfillmentError: string | null },
  attention: "failed" | "unsubmitted" | "printful_stuck" | "printful_unchecked" | null
): string | null {
  if (order.status !== "paid") return null
  if (order.fulfillmentError) return order.fulfillmentError
  return attention === "unsubmitted"
    ? "Payment was received but the order was never sent to Printful."
    : null
}
