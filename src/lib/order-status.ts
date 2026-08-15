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
