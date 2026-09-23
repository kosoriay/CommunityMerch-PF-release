import Link from "next/link"
import { shortOrderId } from "@/lib/order-search"
import { formatCents } from "@/lib/format"
import type { AttentionOrder, NeedsAttentionOrders } from "@/lib/orders"
import {
  UNSUBMITTED_ORDER_ALERT_MINUTES,
  printfulFixGuidance,
  printfulUncheckedGuidance,
} from "@/lib/printful-status"

/**
 * Paid orders that are not on their way to the buyer (設計 2026-09-21 §6.1).
 *
 * Placed above everything else on the admin dashboard: the buyer has been
 * charged and nothing ships until someone acts, so it outranks any statistic.
 * Four groups, because each is fixed a different way.
 */
export function NeedsAttention({ attention }: { attention: NeedsAttentionOrders }) {
  const total =
    attention.failed.length +
    attention.unsubmitted.length +
    attention.printful_stuck.length +
    attention.printful_unchecked.length
  if (total === 0) return null

  // Every order failing on authorization points at one cause, not many.
  // Applies to group A only — the others do not carry a submission error.
  const allAuthErrors =
    attention.failed.length > 1 &&
    attention.failed.every((o) => /401|unauthor|token|api key/i.test(o.fulfillmentError ?? ""))

  return (
    <div className="rounded-lg border border-red-300 bg-red-50">
      <div className="px-4 py-3 border-b border-red-200">
        <h2 className="font-semibold text-red-900">
          Needs attention — {total} paid {total === 1 ? "order" : "orders"} not on their way
        </h2>
        <p className="text-sm text-red-800 mt-1">
          These buyers have been charged. Nothing ships until each one is resolved.
        </p>
      </div>

      <Group
        title="Not sent to production"
        orders={attention.failed}
        intro={
          allAuthErrors && (
            <p className="px-4 pt-2 text-sm text-red-900 font-medium">
              Every one failed on authorization — check whether the Printful API token has expired.
              Tokens last at most two years and expiry stops all orders at once.
            </p>
          )
        }
        detail={(order) => <p className="text-xs text-red-700 mt-1 break-words">{order.fulfillmentError}</p>}
      />

      <Group
        title="Paid but never sent to Printful"
        orders={attention.unsubmitted}
        detail={() => (
          <p className="text-xs text-red-700 mt-1">
            Paid {UNSUBMITTED_ORDER_ALERT_MINUTES}+ minutes ago and not submitted. Open it and retry.
          </p>
        )}
      />

      <Group
        title="Stopped at Printful"
        orders={attention.printful_stuck}
        detail={(order) => (
          <div className="text-xs text-red-700 mt-1 space-y-1 break-words">
            <p>
              Printful: <span className="font-medium">{order.printfulStatus}</span>
              {order.printfulStatusReason ? ` — ${order.printfulStatusReason}` : ""}
            </p>
            <p>{printfulFixGuidance(order.printfulStatus ?? "")}</p>
            <PrintfulMeta order={order} />
            {order.printfulCheckError && <p>Last check failed: {order.printfulCheckError}</p>}
          </div>
        )}
      />

      <Group
        title="Printful status not confirmed"
        orders={attention.printful_unchecked}
        detail={(order) => (
          <div className="text-xs text-red-700 mt-1 space-y-1 break-words">
            <p>{printfulUncheckedGuidance(order.printfulCheckError)}</p>
            <PrintfulMeta order={order} />
          </div>
        )}
      />
    </div>
  )
}

function Group({
  title,
  orders,
  intro,
  detail,
}: {
  title: string
  orders: AttentionOrder[]
  intro?: React.ReactNode
  detail: (order: AttentionOrder) => React.ReactNode
}) {
  if (orders.length === 0) return null
  return (
    <div className="border-b border-red-200 last:border-b-0">
      <h3 className="px-4 pt-3 text-sm font-semibold text-red-900">
        {title} ({orders.length})
      </h3>
      {intro}
      <div className="divide-y divide-red-200">
        {orders.map((order) => (
          <div
            key={order.id}
            className="flex flex-col gap-1 md:flex-row md:items-start md:justify-between px-4 py-3"
          >
            <div className="min-w-0">
              <Link href={`/admin/orders/${order.id}`} className="font-mono font-medium hover:underline">
                {shortOrderId(order.id)}
              </Link>
              <p className="text-xs text-red-800 truncate">
                {order.campaign.title} · {order.campaign.org.name} ·{" "}
                {order.buyerEmail ?? "no buyer email"}
              </p>
              {detail(order)}
            </div>
            <div className="flex items-center gap-3 text-xs shrink-0">
              <span className="text-red-700">
                {order.fulfillmentAttempts}{" "}
                {order.fulfillmentAttempts === 1 ? "attempt" : "attempts"} · {ageInDays(order.createdAt)}
              </span>
              <span className="font-medium">{formatCents(order.totalAmountCents)}</span>
              <Link href={`/admin/orders/${order.id}`} className="text-red-800 underline hover:no-underline">
                Fix →
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function PrintfulMeta({ order }: { order: AttentionOrder }) {
  return (
    <p>
      Printful order {order.printfulOrderId ? `#${order.printfulOrderId}` : "unknown"} · last checked{" "}
      {order.printfulStatusCheckedAt ? new Date(order.printfulStatusCheckedAt).toLocaleString() : "never"}
    </p>
  )
}

function ageInDays(createdAt: Date): string {
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000)
  if (days === 0) return "today"
  return `${days} ${days === 1 ? "day" : "days"} old`
}
