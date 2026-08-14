import { db } from "@/lib/db/client"
import { orders, orderItems } from "@/lib/db/schema"
import { eq, and, isNotNull, desc } from "drizzle-orm"

export type CartItem = {
  campaignProductId: string
  size: string
  quantity: number
  unitPriceCents: number
  color?: string
}

export async function createPendingOrder(
  campaignId: string,
  cartItems: CartItem[]
): Promise<typeof orders.$inferSelect> {
  const id = crypto.randomUUID()
  const now = new Date()
  const totalAmountCents = cartItems.reduce(
    (sum, item) => sum + item.unitPriceCents * item.quantity,
    0
  )

  await db.transaction(async (tx) => {
    await tx.insert(orders).values({
      id,
      campaignId,
      totalAmountCents,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    })
    for (const item of cartItems) {
      await tx.insert(orderItems).values({
        id: crypto.randomUUID(),
        orderId: id,
        campaignProductId: item.campaignProductId,
        size: item.size,
        color: item.color ?? "White",
        quantity: item.quantity,
        unitPrice: item.unitPriceCents,
      })
    }
  })

  return (await db.query.orders.findFirst({ where: eq(orders.id, id) }))!
}

export async function getOrder(orderId: string) {
  return db.query.orders.findFirst({
    where: eq(orders.id, orderId),
    with: {
      items: {
        with: { product: true },
      },
      campaign: {
        with: { org: true, design: true },
      },
    },
  })
}

export async function markOrderPaid(
  orderId: string,
  data: {
    stripePaymentIntentId: string
    stripeCheckoutSessionId: string
    buyerEmail: string
    buyerName: string
    shippingAddressJson: string
  }
): Promise<void> {
  await db
    .update(orders)
    .set({
      status: "paid",
      stripePaymentIntentId: data.stripePaymentIntentId,
      stripeCheckoutSessionId: data.stripeCheckoutSessionId,
      buyerEmail: data.buyerEmail,
      buyerName: data.buyerName,
      shippingAddressJson: data.shippingAddressJson,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, orderId))
}

export async function markOrderFulfilled(
  orderId: string,
  printfulOrderId: number
): Promise<void> {
  await db
    .update(orders)
    .set({
      status: "fulfilled",
      printfulOrderId: String(printfulOrderId),
      // Clear the failure: without this a successful retry leaves the order
      // on the needs-attention list forever.
      fulfillmentError: null,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, orderId))
}

export async function markOrderShipped(
  orderId: string,
  data: {
    trackingNumber: string
    carrier: string
    trackingUrl: string
  }
): Promise<void> {
  await db
    .update(orders)
    .set({
      status: "shipped",
      trackingNumber: data.trackingNumber,
      carrier: data.carrier,
      trackingUrl: data.trackingUrl,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, orderId))
}

export async function markFulfillmentFailed(
  orderId: string,
  errorMessage: string
): Promise<void> {
  const current = await db.query.orders.findFirst({
    where: eq(orders.id, orderId),
  })
  await db
    .update(orders)
    .set({
      fulfillmentAttempts: (current?.fulfillmentAttempts ?? 0) + 1,
      fulfillmentError: errorMessage,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, orderId))
}

/**
 * Orders the buyer has paid for that never reached the print provider.
 *
 * These are the worst state the system can be in: money is captured, the
 * organization has been credited, and nothing will ever ship unless someone
 * intervenes. Nothing surfaced them until now — they were only visible in
 * function logs.
 */
export async function getFailedFulfillmentOrders() {
  return db.query.orders.findMany({
    where: and(eq(orders.status, "paid"), isNotNull(orders.fulfillmentError)),
    orderBy: [desc(orders.createdAt)],
    with: { campaign: { with: { org: true } } },
  })
}

export type FailedFulfillmentOrder = Awaited<
  ReturnType<typeof getFailedFulfillmentOrders>
>[number]

/** Correct a bad recipient address before retrying — the most common fixable cause. */
export async function updateShippingAddress(
  orderId: string,
  address: {
    line1: string
    line2?: string
    city: string
    state: string
    postal_code: string
    country?: string
  },
  buyerName?: string
): Promise<void> {
  await db
    .update(orders)
    .set({
      shippingAddressJson: JSON.stringify({ ...address, country: address.country ?? "US" }),
      ...(buyerName ? { buyerName } : {}),
      updatedAt: new Date(),
    })
    .where(eq(orders.id, orderId))
}
