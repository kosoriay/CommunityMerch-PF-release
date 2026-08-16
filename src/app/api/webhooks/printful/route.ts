import { NextRequest, NextResponse } from "next/server"
import { markOrderShipped, getOrder } from "@/lib/orders"
import { sendShippingNotificationEmail } from "@/lib/email"
import { fromPrintfulExternalId } from "@/lib/printful-ids"
import { getOrCreateConfig } from "@/lib/platform-config"
import { alertPrintfulResolution } from "@/lib/fulfillment-alerts"

if (!process.env.PRINTFUL_WEBHOOK_SECRET) {
  throw new Error("PRINTFUL_WEBHOOK_SECRET is required")
}
const WEBHOOK_SECRET = process.env.PRINTFUL_WEBHOOK_SECRET

type PrintfulShipmentPayload = {
  type: string
  data: {
    order: {
      id: number
      external_id: string
      status: string
    }
    shipment: {
      id: number
      carrier: string
      service: string
      tracking_number: string
      tracking_url: string
      ship_date: string
    }
  }
}

export async function POST(request: NextRequest) {
  // Authenticate via shared secret in query param
  const secret = request.nextUrl.searchParams.get("secret")
  if (secret !== WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let payload: PrintfulShipmentPayload
  try {
    payload = await request.json() as PrintfulShipmentPayload
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  // Printful resolves claims on their side and tells us afterwards. We cannot
  // file the claim through their API, so this is the only signal that a reprint
  // was credited back or a package came home.
  if (payload.type === "order_refunded" || payload.type === "package_returned") {
    const resolvedId = fromPrintfulExternalId(payload.data.order.external_id)
    if (!resolvedId) {
      console.error(`[printful-webhook] ${payload.type} with no external_id`)
      return NextResponse.json({ received: true })
    }
    const resolved = await getOrder(resolvedId)
    if (!resolved) {
      console.error(`[printful-webhook] order not found: ${resolvedId}`)
      return NextResponse.json({ received: true })
    }

    // Deliberately not touching `status`. `refunded` there means the buyer got
    // their money back through Stripe; Printful crediting the production cost
    // to the platform owner is a different event, and marking it as a buyer
    // refund would take the order out of revenue that the organization is
    // still owed.
    await alertPrintfulResolution({
      orderId: resolvedId,
      event: payload.type,
      campaignTitle: resolved.campaign.title,
      orgName: resolved.campaign.org.name,
      printfulOrderId: resolved.printfulOrderId,
    })
    return NextResponse.json({ received: true })
  }

  if (payload.type !== "package_shipped") {
    return NextResponse.json({ received: true })
  }

  const { order: printfulOrder, shipment } = payload.data
  // external_id is the hyphen-stripped order UUID (Printful's 32-char limit)
  const orderId = fromPrintfulExternalId(printfulOrder.external_id)

  if (!orderId) {
    console.error("[printful-webhook] no external_id in payload")
    return NextResponse.json({ received: true })
  }

  try {
    const order = await getOrder(orderId)
    if (!order) {
      console.error(`[printful-webhook] order not found: ${orderId}`)
      return NextResponse.json({ received: true })
    }

    // Idempotency: skip if already shipped
    if (order.status === "shipped" || order.status === "delivered") {
      console.log(`[printful-webhook] already shipped: ${orderId}`)
      return NextResponse.json({ received: true })
    }

    await markOrderShipped(orderId, {
      trackingNumber: shipment.tracking_number,
      carrier: shipment.carrier,
      trackingUrl: shipment.tracking_url,
    })

    if (order.buyerEmail) {
      const config = await getOrCreateConfig()
      await sendShippingNotificationEmail(order.buyerEmail, {
        orderId,
        buyerName: order.buyerName ?? "Customer",
        campaignTitle: order.campaign.title,
        carrier: shipment.carrier,
        trackingNumber: shipment.tracking_number,
        trackingUrl: shipment.tracking_url,
        platformName: config.platformName,
        supportEmail: config.supportEmail,
      })
    }

    console.log(`[printful-webhook] shipped: order=${orderId} tracking=${shipment.tracking_number}`)
  } catch (err) {
    console.error("[printful-webhook] handler error:", err)
    return NextResponse.json({ error: "Handler error" }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
