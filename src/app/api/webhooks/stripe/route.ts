import { NextRequest, NextResponse } from "next/server"
import { after } from "next/server"
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
// Stripe issues a separate signing secret per endpoint, and "your account"
// events (checkout.session.completed) vs "connected accounts" events
// (account.updated) can only be delivered to separate endpoints. Both
// endpoints point at this route, so verification tries each configured
// secret. STRIPE_CONNECT_WEBHOOK_SECRET is optional — without it, connected
// account events cannot be verified and org onboarding never completes.
const WEBHOOK_SECRETS = [
  process.env.STRIPE_WEBHOOK_SECRET,
  process.env.STRIPE_CONNECT_WEBHOOK_SECRET,
].filter((s): s is string => Boolean(s))

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const signature = request.headers.get("stripe-signature")

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 })
  }

  let event: Stripe.Event | null = null
  for (const secret of WEBHOOK_SECRETS) {
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, secret)
      break
    } catch {
      // try the next configured secret
    }
  }
  if (!event) {
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

      // Runs after the 200 response is sent, but — unlike a bare floating
      // promise — after() keeps the serverless function alive until it
      // finishes. Fulfillment errors still never cause a 500 (Stripe retries
      // would create duplicate Printful orders); submitFulfillment records
      // failures internally.
      after(async () => {
        try {
          await submitFulfillment(orderId)
        } catch (err) {
          console.error("[webhook] fulfillment error (async):", err)
        }
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
