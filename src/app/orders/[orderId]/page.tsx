import { notFound } from "next/navigation"
import Link from "next/link"
import { getOrder } from "@/lib/orders"
import { formatCents } from "@/lib/format"
import { getCatalogItem } from "@/lib/catalog-db"
import { getOrCreateConfig } from "@/lib/platform-config"
import { orderDisplayStage, ORDER_DISPLAY_STAGE_LABELS, type OrderDisplayStage } from "@/lib/order-display-stage"

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

  // 購入者には「支払い受領・準備中」までしか見せない。Printful 側の失敗は見せない
  // （設計 2026-09-21 §8・D3）。以前は paid〜delivered を1つの真偽値に潰し、
  // 確認メールを送ったかどうかを知らないまま「送った」と書いていた（C13）。
  const stage = orderDisplayStage(order.status, order.printfulStatus)
  const thanks = `Thank you${order.buyerName ? `, ${order.buyerName}` : ""}.`

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="max-w-xl mx-auto px-4 py-12 space-y-6">
        {/* Status */}
        <div className="text-center space-y-2">
          <StageHeading stage={stage} thanks={thanks} />
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
            <p className="font-medium">{ORDER_DISPLAY_STAGE_LABELS[stage]}</p>
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
            can&apos;t match a package to your order.{" "}
            <Link href="/help" className="text-[#378ADD] hover:underline">
              See common questions
            </Link>
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

function StageHeading({ stage, thanks }: { stage: OrderDisplayStage; thanks: string }) {
  switch (stage) {
    case "processing":
      return (
        <>
          <div className="text-4xl">⏳</div>
          <h1 className="text-2xl font-bold text-[#2E4057]">Payment processing…</h1>
          <p className="text-muted-foreground text-sm">
            Your order is being confirmed. This page will reflect the final status shortly.
          </p>
        </>
      )
    case "preparing":
      return (
        <>
          <div className="text-4xl">🎉</div>
          <h1 className="text-2xl font-bold text-[#2E4057]">Payment received</h1>
          <p className="text-muted-foreground">{thanks} We&apos;re preparing your order.</p>
        </>
      )
    case "in_production":
      return (
        <>
          <div className="text-4xl">🎉</div>
          <h1 className="text-2xl font-bold text-[#2E4057]">In production</h1>
          <p className="text-muted-foreground">{thanks} Your order is being made.</p>
        </>
      )
    case "shipped":
      return (
        <>
          <div className="text-4xl">📦</div>
          <h1 className="text-2xl font-bold text-[#2E4057]">Shipped</h1>
          <p className="text-muted-foreground">{thanks} Your order is on its way.</p>
        </>
      )
    case "refunded":
      return (
        <>
          <h1 className="text-2xl font-bold text-[#2E4057]">Refunded</h1>
          <p className="text-muted-foreground">This order has been refunded.</p>
        </>
      )
  }
}
