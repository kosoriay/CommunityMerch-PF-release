import { NextRequest, NextResponse } from "next/server"
import { stripe } from "@/lib/providers/stripe"
import { markOrderPaid } from "@/lib/orders"
import { submitFulfillment } from "@/lib/fulfillment"
import { db } from "@/lib/db/client"
import { organizations } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import type Stripe from "stripe"

if (!process.env.STRIPE_WEBHOOK_SECRET) {
  throw new Error("STRIPE_WEBHOOK_SECRET is required")
}
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const signature = request.headers.get("stripe-signature")

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, WEBHOOK_SECRET)
  } catch {
    return NextResponse.json({ error: "Webhook signature verification failed" }, { status: 400 })
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session
      const orderId = session.metadata?.orderId
      if (!orderId) {
        console.error("[webhook] checkout.session.completed: no orderId in metadata")
        return NextResponse.json({ received: true })
      }

      const shippingAddress = session.collected_information?.shipping_details?.address ?? null
      await markOrderPaid(orderId, {
        stripePaymentIntentId: session.payment_intent as string,
        stripeCheckoutSessionId: session.id,
        buyerEmail: session.customer_details?.email ?? "",
        buyerName: session.customer_details?.name ?? "",
        shippingAddressJson: shippingAddress ? JSON.stringify(shippingAddress) : "",
      })

      // Fire-and-forget: fulfillment errors must NOT cause a 500 (Stripe retries = duplicate Printful orders)
      submitFulfillment(orderId).catch((err) => {
        console.error("[webhook] fulfillment error (async):", err)
      })
    }

    if (event.type === "account.updated") {
      const account = event.data.object as Stripe.Account
      const isReady = account.charges_enabled && account.payouts_enabled
      if (isReady) {
        await db
          .update(organizations)
          .set({ stripeOnboardingComplete: true, updatedAt: new Date() })
          .where(eq(organizations.stripeAccountId, account.id))
      }
    }
  } catch (err) {
    console.error("[webhook] handler error:", err)
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
