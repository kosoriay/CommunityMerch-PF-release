import { notFound } from "next/navigation"
import Link from "next/link"
import { getOrder } from "@/lib/orders"
import { formatCents } from "@/lib/format"
import { getCatalogItem } from "@/lib/catalog-db"
import { getOrCreateConfig } from "@/lib/platform-config"

export const dynamic = "force-dynamic"

type ShippingAddress = {
  line1?: string
  line2?: string
  city?: string
  state?: string
  postal_code?: string
  country?: string
}

type Props = {
  params: Promise<{ orderId: string }>
  searchParams: Promise<{ success?: string }>
}

export default async function OrderConfirmationPage({ params, searchParams }: Props) {
  const { orderId } = await params
  await searchParams
  const [order, platformCfg] = await Promise.all([
    getOrder(orderId),
    getOrCreateConfig(),
  ])

  if (!order) notFound()

  const itemsWithCatalog = await Promise.all(
    order.items.map(async (item) => ({
      ...item,
      catalogItem: await getCatalogItem(item.product.printfulVariantId),
    }))
  )

  const shippingAddress = order.shippingAddressJson
    ? (JSON.parse(order.shippingAddressJson) as ShippingAddress)
    : null

  const isPaid =
    order.status === "paid" ||
    order.status === "fulfilled" ||
    order.status === "shipped" ||
    order.status === "delivered"

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="max-w-xl mx-auto px-4 py-12 space-y-6">
        {/* Status */}
        <div className="text-center space-y-2">
          {isPaid ? (
            <>
              <div className="text-4xl">🎉</div>
              <h1 className="text-2xl font-bold text-[#2E4057]">Order confirmed!</h1>
              <p className="text-muted-foreground">
                Thank you{order.buyerName ? `, ${order.buyerName}` : ""}.{" "}
                {order.buyerEmail
                  ? `A confirmation has been sent to ${order.buyerEmail}.`
                  : ""}
              </p>
            </>
          ) : (
            <>
              <div className="text-4xl">⏳</div>
              <h1 className="text-2xl font-bold text-[#2E4057]">Payment processing…</h1>
              <p className="text-muted-foreground text-sm">
                Your order is being confirmed. This page will reflect the final status shortly.
              </p>
            </>
          )}
        </div>

        {/* Order details */}
        <div className="rounded-lg border bg-white p-6 space-y-4">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Order</span>
            <span className="font-mono">{order.id.slice(0, 8).toUpperCase()}</span>
          </div>

          <div>
            <p className="text-sm font-medium mb-2">
              {order.campaign.title} · {order.campaign.org.name}
            </p>
            <ul className="space-y-2">
              {itemsWithCatalog.map((item) => (
                  <li key={item.id} className="flex justify-between text-sm">
                    <span>
                      {item.catalogItem?.name ?? item.product.printfulVariantId} — {item.size} ×{" "}
                      {item.quantity}
                    </span>
                    <span className="font-medium">
                      {formatCents(item.unitPrice * item.quantity)}
                    </span>
                  </li>
                )
              )}
            </ul>
          </div>

          <div className="border-t pt-3 flex justify-between font-semibold">
            <span>Total</span>
            <span>{formatCents(order.totalAmountCents)}</span>
          </div>

          {shippingAddress && (
            <div className="border-t pt-3 text-sm">
              <p className="text-muted-foreground mb-1">Shipping to</p>
              <p>{shippingAddress.line1}</p>
              {shippingAddress.line2 && <p>{shippingAddress.line2}</p>}
              <p>
                {shippingAddress.city}, {shippingAddress.state} {shippingAddress.postal_code}
              </p>
            </div>
          )}

          <div className="border-t pt-3 text-sm">
            <p className="text-muted-foreground">Status</p>
            <p className="font-medium capitalize">{order.status}</p>
          </div>
        </div>

        {/* The parcel ships from a printing facility that carries no branding of
            ours, so this page and the confirmation email are where a buyer has
            to be able to find us. */}
        <div className="rounded-lg border bg-white p-6 space-y-2">
          <p className="text-sm font-medium text-[#2E4057]">Need help with this order?</p>
          {platformCfg.supportEmail ? (
            <p className="text-sm text-muted-foreground">
              Email{" "}
              <a
                href={`mailto:${platformCfg.supportEmail}?subject=${encodeURIComponent(
                  `Order ${order.id.slice(0, 8).toUpperCase()}`
                )}`}
                className="text-[#378ADD] hover:underline"
              >
                {platformCfg.supportEmail}
              </a>{" "}
              and include your order number{" "}
              <span className="font-mono">{order.id.slice(0, 8).toUpperCase()}</span>. If an item
              arrived damaged or misprinted, attach a photo — that is all we need to send a
              replacement.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Contact {platformCfg.platformName} and quote your order number{" "}
              <span className="font-mono">{order.id.slice(0, 8).toUpperCase()}</span>.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Please don&apos;t ship returns to the address printed on the parcel — that facility
            can&apos;t match a package to your order.
          </p>
        </div>

        <div className="text-center">
          <Link
            href={`/${order.campaign.slug}`}
            className="text-sm text-[#378ADD] hover:underline"
          >
            ← Back to campaign
          </Link>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Powered by {platformCfg.platformName}
        </p>
      </div>
    </div>
  )
}
