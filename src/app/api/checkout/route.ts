import { NextRequest, NextResponse } from "next/server"
import { stripe, calculateApplicationFee } from "@/lib/providers/stripe"
import { createPendingOrder, type CartItem } from "@/lib/orders"
import { getCampaign } from "@/lib/campaigns"
import { db } from "@/lib/db/client"
import { organizations } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

type CheckoutBody = {
  campaignId: string
  orgId: string
  items: CartItem[]
}

export async function POST(request: NextRequest) {
  let body: CheckoutBody
  try {
    body = await request.json() as CheckoutBody
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { campaignId, orgId, items } = body

  if (!items || items.length === 0) {
    return NextResponse.json({ error: "Cart is empty" }, { status: 400 })
  }

  // Validate campaign
  const campaign = await getCampaign(campaignId)
  if (!campaign || campaign.status !== "active" || campaign.orgId !== orgId) {
    return NextResponse.json({ error: "Campaign not found or not active" }, { status: 404 })
  }

  // Validate org has Stripe Connect
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, orgId),
  })
  if (!org?.stripeAccountId || !org.stripeOnboardingComplete) {
    return NextResponse.json({ error: "Organization payment setup is incomplete" }, { status: 400 })
  }

  // Check org suspension before touching the DB further
  if (org.suspendedAt) {
    return NextResponse.json({ error: "This campaign is currently unavailable" }, { status: 403 })
  }

  // Use the fee rate snapshot locked at campaign publish time (basis points → decimal)
  const feeRate = campaign.platformFeeRate / 10000

  // Validate cart items against campaign products
  const productMap = new Map(campaign.products.map((p) => [p.id, p]))
  for (const item of items) {
    const product = productMap.get(item.campaignProductId)
    if (!product) {
      return NextResponse.json({ error: `Product not found: ${item.campaignProductId}` }, { status: 400 })
    }
    if (item.unitPriceCents !== product.retailPrice) {
      return NextResponse.json({ error: "Price mismatch — please refresh the page" }, { status: 400 })
    }
    if (item.quantity < 1 || item.quantity > 10) {
      return NextResponse.json({ error: "Quantity must be between 1 and 10" }, { status: 400 })
    }
  }

  // Create pending order
  const order = await createPendingOrder(campaignId, items)

  const appUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3000"
  const totalCents = items.reduce((sum, i) => sum + i.unitPriceCents * i.quantity, 0)
  const applicationFeeCents = calculateApplicationFee(totalCents, feeRate)

  // Build Stripe line items
  const lineItems = items.map((item) => {
    const product = productMap.get(item.campaignProductId)!
    return {
      price_data: {
        currency: "usd",
        unit_amount: item.unitPriceCents,
        product_data: {
          name: `${product.printfulVariantId} — Size ${item.size}`,
          metadata: { campaignProductId: item.campaignProductId, size: item.size },
        },
      },
      quantity: item.quantity,
    }
  })

  // Create Stripe Checkout Session
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: lineItems,
    payment_intent_data: {
      application_fee_amount: applicationFeeCents,
      transfer_data: { destination: org.stripeAccountId },
    },
    shipping_address_collection: { allowed_countries: ["US"] },
    success_url: `${appUrl}/orders/${order.id}?success=1`,
    cancel_url: `${appUrl}/${campaign.slug}`,
    metadata: { orderId: order.id },
  })

  return NextResponse.json({ checkoutUrl: session.url })
}
