import { NextRequest, NextResponse } from "next/server"
import { markOrderShipped, getOrder } from "@/lib/orders"
import { sendShippingNotificationEmail } from "@/lib/email"
import { fromPrintfulExternalId } from "@/lib/printful-ids"

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
      await sendShippingNotificationEmail(order.buyerEmail, {
        orderId,
        buyerName: order.buyerName ?? "Customer",
        campaignTitle: order.campaign.title,
        carrier: shipment.carrier,
        trackingNumber: shipment.tracking_number,
        trackingUrl: shipment.tracking_url,
      })
    }

    console.log(`[printful-webhook] shipped: order=${orderId} tracking=${shipment.tracking_number}`)
  } catch (err) {
    console.error("[printful-webhook] handler error:", err)
    return NextResponse.json({ error: "Handler error" }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
