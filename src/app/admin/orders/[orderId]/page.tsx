import Link from "next/link"
import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { auth } from "@/lib/auth"
import { getOrder } from "@/lib/orders"
import { getCatalogItem } from "@/lib/catalog-db"
import { shortOrderId } from "@/lib/order-search"
import { formatCents } from "@/lib/format"
import { toPrintfulExternalId } from "@/lib/printful-ids"
import { isRefundable } from "@/lib/order-status"
import { orderRefundBreakdown } from "@/lib/refunds"
import { OrderStatusBadge } from "../../_components/OrderStatusBadge"
import { RefundPanel } from "./_refund-panel"

export const dynamic = "force-dynamic"

type ShippingAddress = {
  line1?: string
  line2?: string
  city?: string
  state?: string
  postal_code?: string
  country?: string
}

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>
}) {
  const { orderId } = await params
  const [order, session] = await Promise.all([
    getOrder(orderId),
    auth.api.getSession({ headers: await headers() }),
  ])
  if (!order) notFound()

  // Moving money is platform_admin only; platform_staff is read-only support.
  const isPlatformAdmin = session?.user.platformRole === "platform_admin"
  const breakdown = orderRefundBreakdown(order)

  const items = await Promise.all(
    order.items.map(async (item) => ({
      ...item,
      catalogItem: await getCatalogItem(item.product.printfulVariantId),
    }))
  )

  const shipping = order.shippingAddressJson
    ? (JSON.parse(order.shippingAddressJson) as ShippingAddress)
    : null

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/orders" className="text-sm text-blue-600 hover:underline">
          ← All orders
        </Link>
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between mt-2">
          <div>
            <h1 className="text-2xl font-bold font-mono">{shortOrderId(order.id)}</h1>
            <p className="text-sm text-muted-foreground">
              Placed {new Date(order.createdAt).toLocaleString()}
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <OrderStatusBadge status={order.status} />
          </div>
        </div>
      </div>

      {order.fulfillmentError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="font-medium text-red-800 text-sm">Fulfillment failed</p>
          <p className="text-sm text-red-700 mt-1">{order.fulfillmentError}</p>
          <p className="text-xs text-red-600 mt-2">
            Attempts: {order.fulfillmentAttempts}. This order has not reached Printful — the
            buyer has paid and is waiting.
          </p>
        </div>
      )}

      <Section title="Buyer">
        <Row label="Name" value={order.buyerName ?? "—"} />
        <Row
          label="Email"
          value={
            order.buyerEmail ? (
              <a href={`mailto:${order.buyerEmail}`} className="text-blue-600 hover:underline">
                {order.buyerEmail}
              </a>
            ) : (
              "—"
            )
          }
        />
        {shipping && (
          <Row
            label="Shipping to"
            value={
              <span className="text-right">
                {shipping.line1}
                {shipping.line2 ? `, ${shipping.line2}` : ""}
                <br />
                {shipping.city}, {shipping.state} {shipping.postal_code}
              </span>
            }
          />
        )}
      </Section>

      <Section title="Campaign">
        <Row
          label="Campaign"
          value={
            <Link href={`/${order.campaign.slug}`} className="text-blue-600 hover:underline">
              {order.campaign.title}
            </Link>
          }
        />
        <Row
          label="Organization"
          value={
            <Link
              href={`/admin/orgs/${order.campaign.orgId}`}
              className="text-blue-600 hover:underline"
            >
              {order.campaign.org.name}
            </Link>
          }
        />
      </Section>

      <Section title="Items">
        {items.map((item) => (
          <Row
            key={item.id}
            label={`${item.catalogItem?.name ?? item.product.printfulVariantId} — ${item.size} · ${item.color} × ${item.quantity}`}
            value={formatCents(item.unitPrice * item.quantity)}
          />
        ))}
        <Row label={<span className="font-semibold">Total charged</span>} value={
          <span className="font-semibold">{formatCents(order.totalAmountCents)}</span>
        } />
      </Section>

      <Section title="Fulfillment">
        <Row
          label="Printful order"
          value={
            order.printfulOrderId ? (
              <a
                href={`https://www.printful.com/dashboard/order/${order.printfulOrderId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                #{order.printfulOrderId} ↗
              </a>
            ) : (
              "Not submitted"
            )
          }
        />
        <Row label="Printful reference" value={<span className="font-mono text-xs">{toPrintfulExternalId(order.id)}</span>} />
        <Row
          label="Tracking"
          value={
            order.trackingUrl ? (
              <a
                href={order.trackingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                {order.carrier ? `${order.carrier} ` : ""}
                {order.trackingNumber ?? "Track ↗"}
              </a>
            ) : (
              "—"
            )
          }
        />
      </Section>

      <Section title="Payment">
        <Row
          label="Stripe payment"
          value={
            order.stripePaymentIntentId ? (
              <a
                href={`https://dashboard.stripe.com/payments/${order.stripePaymentIntentId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline font-mono text-xs"
              >
                {order.stripePaymentIntentId} ↗
              </a>
            ) : (
              "—"
            )
          }
        />
      </Section>

      {order.status === "refunded" ? (
        <Section title="Refund">
          <Row
            label="Refunded"
            value={order.refundedAt ? new Date(order.refundedAt).toLocaleString() : "—"}
          />
          <Row label="Reason" value={order.refundReason ?? "—"} />
          <Row
            label="Stripe refund"
            value={
              order.stripeRefundId ? (
                <span className="font-mono text-xs">{order.stripeRefundId}</span>
              ) : (
                "—"
              )
            }
          />
          <Row
            label="Transfer reversal"
            value={
              order.transferReversalId ? (
                <span className="font-mono text-xs">{order.transferReversalId}</span>
              ) : (
                "—"
              )
            }
          />
        </Section>
      ) : isRefundable(order.status) && isPlatformAdmin ? (
        <RefundPanel
          orderId={order.id}
          printfulOrderId={order.printfulOrderId ? Number(order.printfulOrderId) : null}
          buyerReceives={formatCents(breakdown.buyerReceivesCents)}
          organizationReturns={formatCents(breakdown.organizationReturnsCents)}
          platformAbsorbs={formatCents(breakdown.platformAbsorbsCents)}
          orgName={order.campaign.org.name}
        />
      ) : null}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg border">
      <div className="px-4 py-3 border-b">
        <h2 className="font-semibold text-sm">{title}</h2>
      </div>
      <div className="divide-y">{children}</div>
    </div>
  )
}

function Row({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 px-4 py-2.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  )
}
