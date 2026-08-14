import { estimateShippingCents, calculateCheckoutApplicationFee } from "@/lib/printful-catalog"

// Pure order economics. Deliberately free of the Stripe client so that any
// surface — progress bars, dashboards, the refund action — can compute what an
// order was worth to each party without pulling in an SDK that needs secrets.

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
