import { getOrder, markOrderFulfilled, markFulfillmentFailed } from "@/lib/orders"
import { getPrintfulVariantId, submitPrintfulOrder } from "@/lib/providers/printful"
import { sendOrderConfirmationEmail } from "@/lib/email"
import { getCatalogItem } from "@/lib/catalog-db"
import { PRINTFUL_DEFAULT_COLOR } from "@/lib/printful-catalog"
import { getOrCreateConfig } from "@/lib/platform-config"
import { buildPackingSlip } from "@/lib/packing-slip"
import type { PrintfulPackingSlip } from "@/lib/providers/printful"

// Main entry point called from the Stripe webhook.
// Errors are caught and recorded — does NOT throw so the webhook stays 200.
export async function submitFulfillment(orderId: string): Promise<void> {
  try {
    const order = await getOrder(orderId)

    if (!order) {
      console.error(`[fulfillment] order not found: ${orderId}`)
      return
    }

    // Skip if already fulfilled (idempotency guard)
    if (order.status === "fulfilled" || order.status === "shipped" || order.status === "delivered") {
      console.log(`[fulfillment] skipping — already ${order.status}: ${orderId}`)
      return
    }

    // Require a design file — block fulfillment if missing
    const designUrl = order.campaign.design?.designFileUrl ?? null
    if (!designUrl) {
      await markFulfillmentFailed(
        orderId,
        "No design file found — manual fulfillment required"
      )
      console.warn(`[fulfillment] blocked — no design file for order ${orderId}`)
      return
    }

    // Parse shipping address from Stripe JSON
    const shipping = order.shippingAddressJson
      ? (JSON.parse(order.shippingAddressJson) as {
          line1?: string
          line2?: string
          city?: string
          state?: string
          postal_code?: string
          country?: string
        })
      : null

    if (!shipping?.line1 || !shipping.city || !shipping.state || !shipping.postal_code) {
      await markFulfillmentFailed(orderId, "Incomplete shipping address")
      return
    }

    // Build Printful line items — resolve numeric variant IDs by (product, size, color)
    const resolvedItems = await Promise.all(
      order.items.map(async (item) => {
        const internalId = item.product.printfulVariantId
        const catalogItem = await getCatalogItem(internalId)
        if (!catalogItem) {
          throw new Error(`No catalog entry for variant: ${internalId}`)
        }
        const variantId = await getPrintfulVariantId(
          catalogItem.printfulProductId,
          item.size,
          item.color ?? PRINTFUL_DEFAULT_COLOR
        )
        return {
          printfulItem: {
            variant_id: variantId,
            quantity: item.quantity,
            files: [{ url: designUrl }],
          },
          catalogName: catalogItem.name,
        }
      })
    )
    const printfulItems = resolvedItems.map((r) => r.printfulItem)
    const catalogNames = resolvedItems.map((r) => r.catalogName)

    // Platform config drives the packing slip and the support footer in the
    // confirmation email. Best-effort: a config read failure must never block a
    // paid order, so fall back to the Printful store defaults rather than throwing.
    let config: Awaited<ReturnType<typeof getOrCreateConfig>> | null = null
    let packingSlip: PrintfulPackingSlip | undefined
    try {
      config = await getOrCreateConfig()
      packingSlip = buildPackingSlip({
        platformName: config.platformName,
        supportEmail: config.supportEmail,
        logoUrl: config.logoUrl,
        orgName: order.campaign.org.name,
        campaignTitle: order.campaign.title,
      })
    } catch (err) {
      console.warn(`[fulfillment] packing slip unavailable for ${orderId}`, err)
    }

    // Submit to Printful (external_id = orderId for deduplication)
    const printfulOrder = await submitPrintfulOrder(
      orderId,
      {
        name: order.buyerName ?? "Customer",
        address1: shipping.line1,
        address2: shipping.line2,
        city: shipping.city,
        state_code: shipping.state,
        zip: shipping.postal_code,
        country_code: shipping.country ?? "US",
      },
      printfulItems,
      packingSlip
    )

    // Update order status
    await markOrderFulfilled(orderId, printfulOrder.id)

    // Send order confirmation email
    if (order.buyerEmail) {
      await sendOrderConfirmationEmail(order.buyerEmail, {
        orderId,
        buyerName: order.buyerName ?? "Customer",
        campaignTitle: order.campaign.title,
        orgName: order.campaign.org.name,
        items: order.items.map((i, idx) => ({
          name: catalogNames[idx] ?? i.product.printfulVariantId,
          size: i.size,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
        })),
        totalAmountCents: order.totalAmountCents,
        shippingAddress: shipping,
        platformName: config?.platformName ?? "the platform",
        supportEmail: config?.supportEmail ?? null,
      })
    }

    console.log(`[fulfillment] completed: order=${orderId} printful=${printfulOrder.id}`)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown fulfillment error"
    console.error(`[fulfillment] failed: order=${orderId}`, message)
    await markFulfillmentFailed(orderId, message)
  }
}
