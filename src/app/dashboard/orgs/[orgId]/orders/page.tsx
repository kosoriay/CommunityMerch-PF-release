import Link from "next/link"
import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { auth } from "@/lib/auth"
import { requireOrgAccess } from "@/lib/middleware/require-org-access"
import { getOrgOrders } from "@/lib/orgs-orders"
import { formatCents } from "@/lib/format"
import { shortOrderId } from "@/lib/order-search"

export const dynamic = "force-dynamic"

const STATUS_STYLES: Record<string, string> = {
  paid: "bg-blue-100 text-blue-700",
  fulfilled: "bg-indigo-100 text-indigo-700",
  shipped: "bg-amber-100 text-amber-700",
  delivered: "bg-green-100 text-green-700",
  refunded: "bg-red-100 text-red-700",
}

type Props = { params: Promise<{ orgId: string }> }

export default async function OrgOrdersPage({ params }: Props) {
  const { orgId } = await params
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) notFound()

  // Order-level money is for the people running the organization. Students
  // take part in the campaign but do not see what individual buyers paid.
  try {
    await requireOrgAccess(session.user.id, orgId, "member")
  } catch {
    notFound()
  }

  const orders = await getOrgOrders(orgId)
  const refundedCount = orders.filter((o) => o.status === "refunded").length

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/dashboard/orgs/${orgId}`}
          className="text-sm text-[#378ADD] hover:underline"
        >
          ← Back to organization
        </Link>
        <h1 className="text-2xl font-semibold text-[#2E4057] mt-2">Orders</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Every order across your campaigns.
          {refundedCount > 0 && (
            <>
              {" "}
              {refundedCount} {refundedCount === 1 ? "order has" : "orders have"} been refunded and
              {refundedCount === 1 ? " is" : " are"} not counted toward your total raised.
            </>
          )}
        </p>
      </div>

      {orders.length === 0 ? (
        <div className="rounded-lg border bg-white px-4 py-12 text-center text-sm text-muted-foreground">
          No orders yet. Share your campaign link to start collecting them.
        </div>
      ) : (
        <div className="rounded-lg border bg-white divide-y">
          {orders.map((order) => (
            <div
              key={order.id}
              className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between px-4 py-3"
            >
              <div className="min-w-0">
                <p className="font-mono text-sm font-medium">{shortOrderId(order.id)}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {order.buyerName ?? "Supporter"}
                  {/* City and state only — the print provider ships, so the
                      organization has no need for a buyer's street address. */}
                  {order.buyerCity ? ` · ${order.buyerCity}` : ""}
                  {order.buyerState ? `, ${order.buyerState}` : ""}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {order.campaignTitle} ·{" "}
                  {order.items.map((i) => `${i.name} ${i.size} ×${i.quantity}`).join(", ")} ·{" "}
                  {new Date(order.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs shrink-0">
                <span
                  className={`px-2 py-0.5 rounded capitalize ${
                    STATUS_STYLES[order.status] ?? "bg-slate-100 text-slate-700"
                  }`}
                >
                  {order.status}
                </span>
                <span
                  className={
                    order.status === "refunded"
                      ? "text-muted-foreground line-through"
                      : "font-medium"
                  }
                >
                  {formatCents(order.netToOrgCents)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Amounts shown are your organization&apos;s share of each order, after production,
        shipping and fees — the amount paid out to your bank account.
      </p>
    </div>
  )
}
