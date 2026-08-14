import Link from "next/link"
import { shortOrderId } from "@/lib/order-search"
import { formatCents } from "@/lib/format"
import type { FailedFulfillmentOrder } from "@/lib/orders"

/**
 * Paid orders that never reached the print provider.
 *
 * Placed above everything else on the admin dashboard: the buyer has been
 * charged and nothing ships until someone acts, so it outranks any statistic.
 */
export function NeedsAttention({ orders }: { orders: FailedFulfillmentOrder[] }) {
  if (orders.length === 0) return null

  // Every order failing on authorization points at one cause, not many.
  const allAuthErrors =
    orders.length > 1 &&
    orders.every((o) => /401|unauthor|token|api key/i.test(o.fulfillmentError ?? ""))

  return (
    <div className="rounded-lg border border-red-300 bg-red-50">
      <div className="px-4 py-3 border-b border-red-200">
        <h2 className="font-semibold text-red-900">
          Needs attention — {orders.length} paid {orders.length === 1 ? "order" : "orders"} not sent
          to production
        </h2>
        <p className="text-sm text-red-800 mt-1">
          These buyers have been charged. Nothing ships until each one is resolved.
        </p>
        {allAuthErrors && (
          <p className="text-sm text-red-900 mt-2 font-medium">
            Every one failed on authorization — check whether the Printful API token has expired.
            Tokens last at most two years and expiry stops all orders at once.
          </p>
        )}
      </div>
      <div className="divide-y divide-red-200">
        {orders.map((order) => (
          <div
            key={order.id}
            className="flex flex-col gap-1 md:flex-row md:items-start md:justify-between px-4 py-3"
          >
            <div className="min-w-0">
              <Link
                href={`/admin/orders/${order.id}`}
                className="font-mono font-medium hover:underline"
              >
                {shortOrderId(order.id)}
              </Link>
              <p className="text-xs text-red-800 truncate">
                {order.campaign.title} · {order.campaign.org.name} ·{" "}
                {order.buyerEmail ?? "no buyer email"}
              </p>
              <p className="text-xs text-red-700 mt-1 break-words">{order.fulfillmentError}</p>
            </div>
            <div className="flex items-center gap-3 text-xs shrink-0">
              <span className="text-red-700">
                {order.fulfillmentAttempts}{" "}
                {order.fulfillmentAttempts === 1 ? "attempt" : "attempts"} ·{" "}
                {ageInDays(order.createdAt)}
              </span>
              <span className="font-medium">{formatCents(order.totalAmountCents)}</span>
              <Link
                href={`/admin/orders/${order.id}`}
                className="text-red-800 underline hover:no-underline"
              >
                Fix →
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ageInDays(createdAt: Date): string {
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000)
  if (days === 0) return "today"
  return `${days} ${days === 1 ? "day" : "days"} old`
}
