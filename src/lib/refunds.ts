import { db } from "@/lib/db/client"
import { orders, organizations } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { stripe } from "@/lib/providers/stripe"
import { isRefundable } from "@/lib/order-status"
import { estimateShippingCents, calculateCheckoutApplicationFee } from "@/lib/printful-catalog"

export type RefundOutcome =
  | { ok: true; refundId: string }
  | { ok: false; error: string; needsConfirmation?: boolean }

/**
 * Refund an order in full.
 *
 * Both Stripe flags are mandatory and neither may be dropped — see
 * `openspec/changes/add-order-refunds/design.md` Decision 1, which records the
 * test-mode ledger measurement behind them:
 *
 *   reverse_transfer        the connected account gives back the transfer
 *   refund_application_fee  the platform gives back the fee it collected
 *
 * Stripe transfers the GROSS charge to the connected account and collects the
 * application fee back from it separately. So `reverse_transfer` alone claws
 * back the full charge while the organization only ever netted charge minus
 * fee — measured at a $21.61 hole on a $28.69 order. That is worse than not
 * refunding at all, and the organization cannot even see it, because these
 * accounts are created with `stripe_dashboard: none`.
 */
export async function refundOrder(params: {
  orderId: string
  reason: string
  refundedByUserId: string
  /** Set once the operator has acknowledged a connected-account shortfall. */
  acknowledgeShortfall?: boolean
}): Promise<RefundOutcome> {
  const { orderId, reason, refundedByUserId, acknowledgeShortfall = false } = params

  const order = await db.query.orders.findFirst({
    where: eq(orders.id, orderId),
    with: { campaign: true, items: { with: { product: true } } },
  })
  if (!order) return { ok: false, error: "Order not found" }

  // Idempotency: never create a second refund for the same order.
  if (order.status === "refunded") {
    return { ok: false, error: "This order has already been refunded" }
  }
  if (!isRefundable(order.status)) {
    return {
      ok: false,
      error: `An order with status "${order.status}" cannot be refunded — the buyer has not been charged`,
    }
  }
  if (!order.stripePaymentIntentId) {
    return { ok: false, error: "No Stripe payment recorded for this order" }
  }
  if (!reason.trim()) {
    return { ok: false, error: "A reason is required" }
  }

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, order.campaign.orgId),
  })

  // The transfer reversal and the application-fee refund settle together, so
  // the connected account's balance only moves by what it netted — NOT by the
  // gross transfer. Checking against the gross reported a shortfall on every
  // refund, because an organization never holds more than its net share.
  const { organizationReturnsCents } = orderRefundBreakdown(order)

  // Warn before committing when the connected account cannot cover the
  // reversal — it will be driven negative and the shortfall lands on the
  // platform owner via `losses.payments: application`.
  if (org?.stripeAccountId && !acknowledgeShortfall) {
    const shortfall = await connectedAccountShortfallCents(
      org.stripeAccountId,
      organizationReturnsCents
    )
    if (shortfall > 0) {
      return {
        ok: false,
        needsConfirmation: true,
        error:
          `${org.name} does not have enough balance to cover this reversal — ` +
          `their account will go about ${formatCents(shortfall)} negative, which ` +
          `Stripe recovers from their future sales.`,
      }
    }
  }

  let refund
  try {
    refund = await stripe.refunds.create({
      payment_intent: order.stripePaymentIntentId,
      reverse_transfer: true,
      refund_application_fee: true,
    })
  } catch (err) {
    // Leave the order status untouched. An order marked refunded when Stripe
    // never refunded is the worst outcome — nobody would go looking again.
    const message = err instanceof Error ? err.message : "Unknown Stripe error"
    return { ok: false, error: `Stripe refused the refund: ${message}` }
  }

  await db
    .update(orders)
    .set({
      status: "refunded",
      refundedAt: new Date(),
      refundedBy: refundedByUserId,
      refundReason: reason.trim(),
      stripeRefundId: refund.id,
      transferReversalId:
        typeof refund.transfer_reversal === "string"
          ? refund.transfer_reversal
          : refund.transfer_reversal?.id ?? null,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, orderId))

  return { ok: true, refundId: refund.id }
}

/** How far short the connected account is of covering a reversal, in cents. */
async function connectedAccountShortfallCents(
  stripeAccountId: string,
  reversalCents: number
): Promise<number> {
  try {
    const balance = await stripe.balance.retrieve({}, { stripeAccount: stripeAccountId })
    const usd = (entries: { amount: number; currency: string }[]) =>
      entries.filter((b) => b.currency === "usd").reduce((sum, b) => sum + b.amount, 0)
    const total = usd(balance.available) + usd(balance.pending)
    return Math.max(0, reversalCents - total)
  } catch {
    // A balance read failure must not block a legitimate refund; the operator
    // simply loses the advance warning.
    return 0
  }
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100)
}

export type RefundBreakdown = {
  buyerReceivesCents: number
  organizationReturnsCents: number
  platformAbsorbsCents: number
}

/**
 * What a refund costs each party, for display before the operator commits.
 *
 * The buyer gets back everything they paid, shipping included. The organization
 * gives back only what it netted — the charge minus the application fee. The
 * remainder is the platform's, and it is unrecoverable: it was already paid to
 * the print provider and to Stripe, and Stripe does not return processing fees
 * on a refund.
 */
export function refundBreakdown(params: {
  itemSubtotalCents: number
  shippingCents: number
  applicationFeeCents: number
}): RefundBreakdown {
  const { itemSubtotalCents, shippingCents, applicationFeeCents } = params
  const buyerReceivesCents = itemSubtotalCents + shippingCents
  const organizationReturnsCents = Math.max(0, buyerReceivesCents - applicationFeeCents)
  return {
    buyerReceivesCents,
    organizationReturnsCents,
    platformAbsorbsCents: buyerReceivesCents - organizationReturnsCents,
  }
}

/**
 * Recompute the breakdown from stored order data, using exactly the inputs
 * checkout used: the campaign's captured fee rate, the POD cost recorded on
 * each campaign product, and shipping derived from the variants ordered.
 * Deterministic — no Stripe call and no dependence on today's catalog prices.
 */
export function orderRefundBreakdown(order: {
  totalAmountCents: number
  campaign: { platformFeeRate: number }
  items: { quantity: number; product: { podCost: number; printfulVariantId: string } }[]
}): RefundBreakdown {
  const podCostCents = order.items.reduce((sum, i) => sum + i.product.podCost * i.quantity, 0)
  const shippingCents = estimateShippingCents(
    order.items.map((i) => ({
      printfulVariantId: i.product.printfulVariantId,
      quantity: i.quantity,
    }))
  )
  const applicationFeeCents = calculateCheckoutApplicationFee({
    itemSubtotalCents: order.totalAmountCents,
    podCostCents,
    shippingCents,
    feeRate: order.campaign.platformFeeRate / 10000,
  })
  return refundBreakdown({
    itemSubtotalCents: order.totalAmountCents,
    shippingCents,
    applicationFeeCents,
  })
}
