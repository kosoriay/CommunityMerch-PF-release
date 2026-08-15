import Link from "next/link"
import { searchOrders } from "@/lib/admin"
import { shortOrderId } from "@/lib/order-search"
import { formatCents } from "@/lib/format"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { OrderStatusBadge } from "../_components/OrderStatusBadge"

export const dynamic = "force-dynamic"

type Props = { searchParams: Promise<{ q?: string }> }

export default async function AdminOrdersPage({ searchParams }: Props) {
  const { q = "" } = await searchParams
  const orders = await searchOrders(q)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Orders</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Search by the order number a buyer quotes, or by their email or name.
        </p>
      </div>

      <form method="get" className="flex flex-col gap-2 sm:flex-row">
        <Input
          name="q"
          defaultValue={q}
          placeholder="A1B2C3D4, buyer@example.com, or a name"
          className="sm:max-w-md"
          aria-label="Search orders"
        />
        <div className="flex gap-2">
          <Button type="submit">Search</Button>
          {q && (
            <Link
              href="/admin/orders"
              className="text-sm text-muted-foreground hover:text-foreground self-center"
            >
              Clear
            </Link>
          )}
        </div>
      </form>

      {orders.length === 0 ? (
        <div className="bg-white rounded-lg border px-4 py-12 text-center text-sm text-muted-foreground">
          {q ? (
            <>
              No orders match <span className="font-mono">{q}</span>.
              <p className="mt-1">
                Buyers quote the 8-character number from their confirmation
                email — a partial number works too.
              </p>
            </>
          ) : (
            "No orders yet."
          )}
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {q ? `${orders.length} match${orders.length === 1 ? "" : "es"}` : `${orders.length} most recent`}
            {orders.length === 50 && " (showing the first 50 — narrow the search)"}
          </p>
          <div className="bg-white rounded-lg border divide-y">
            {orders.map((order) => (
              <div
                key={order.id}
                className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between px-4 py-3"
              >
                <div className="min-w-0">
                  <Link
                    href={`/admin/orders/${order.id}`}
                    className="font-mono font-medium hover:underline"
                  >
                    {shortOrderId(order.id)}
                  </Link>
                  <p className="text-xs text-muted-foreground truncate">
                    {order.buyerName ?? "—"}
                    {order.buyerEmail ? ` · ${order.buyerEmail}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {order.campaign.title} · {order.campaign.org.name} ·{" "}
                    {new Date(order.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center flex-wrap gap-2 text-xs shrink-0">
                  {order.fulfillmentError && (
                    <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded">
                      Fulfillment error
                    </span>
                  )}
                  <OrderStatusBadge status={order.status} />
                  <span className="font-medium">{formatCents(order.totalAmountCents)}</span>
                  <Link
                    href={`/admin/orders/${order.id}`}
                    className="text-blue-600 hover:underline ml-2"
                  >
                    View →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
