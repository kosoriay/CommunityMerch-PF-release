import { toPrintfulExternalId } from "@/lib/printful-ids"

if (!process.env.PRINTFUL_API_KEY) throw new Error("PRINTFUL_API_KEY is required")

const BASE_URL = "https://api.printful.com"
const AUTH = `Bearer ${process.env.PRINTFUL_API_KEY}`

type PrintfulVariantResult = {
  id: number
  size: string
  color: string
}

type PrintfulOrderItem = {
  variant_id: number
  quantity: number
  files?: Array<{ url: string }>
}

type PrintfulRecipient = {
  name: string
  address1: string
  address2?: string
  city: string
  state_code: string
  zip: string
  country_code: string
}

export type PrintfulOrderResult = {
  id: number
  external_id: string
  status: string
}

// Fetch the current Printful price (in cents) for one specific variant of a
// product. Returns null when the product/variant can't be resolved — callers
// treat that as "skip", never as zero.
export async function getPrintfulVariantPriceCents(
  printfulProductId: number,
  variantId: number
): Promise<number | null> {
  const res = await fetch(`${BASE_URL}/products/${printfulProductId}`, {
    headers: { Authorization: AUTH },
  })
  if (!res.ok) return null
  const data = await res.json() as { result: { variants: { id: number; price: string }[] } }
  const variant = data.result.variants.find((v) => v.id === variantId)
  if (!variant) return null
  const cents = Math.round(parseFloat(variant.price) * 100)
  return Number.isFinite(cents) && cents > 0 ? cents : null
}

// Look up Printful numeric variant ID for a given product, size, and color.
export async function getPrintfulVariantId(
  printfulProductId: number,
  size: string,
  color = "White"
): Promise<number> {
  const res = await fetch(`${BASE_URL}/products/${printfulProductId}`, {
    headers: { Authorization: AUTH },
  })
  if (!res.ok) throw new Error(`Printful product lookup failed: ${res.status}`)
  const data = await res.json() as { result: { variants: PrintfulVariantResult[] } }
  const variant = data.result.variants.find(
    (v) => v.size === size && v.color === color
  )
  if (!variant) {
    throw new Error(`No Printful variant found: productId=${printfulProductId} size=${size} color=${color}`)
  }
  return variant.id
}

// Submit a fulfillment order to Printful.
// Uses external_id = orderId for idempotency — Printful deduplicates on this field.
// Orders are confirmed (sent to production and billed to the platform owner's
// Printful payment method) automatically unless PRINTFUL_AUTO_CONFIRM=false,
// which leaves them as drafts for manual review in the Printful dashboard.
export async function submitPrintfulOrder(
  orderId: string,
  recipient: PrintfulRecipient,
  items: PrintfulOrderItem[]
): Promise<PrintfulOrderResult> {
  // Printful rejects external_ids over 32 chars — UUIDs are mapped losslessly
  const externalId = toPrintfulExternalId(orderId)
  const body = {
    external_id: externalId,
    shipping: "STANDARD",
    recipient,
    items,
  }

  const autoConfirm = process.env.PRINTFUL_AUTO_CONFIRM !== "false"

  const res = await fetch(`${BASE_URL}/orders${autoConfirm ? "?confirm=1" : ""}`, {
    method: "POST",
    headers: {
      Authorization: AUTH,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })

  const data = await res.json() as {
    code: number
    result?: PrintfulOrderResult
    // Printful returns error sometimes as a string, sometimes as {reason, message}
    error?: string | { reason?: string; message?: string }
  }

  if (!res.ok) {
    const errorMessage =
      typeof data.error === "string"
        ? data.error
        : data.error?.message ?? data.error?.reason ?? `HTTP ${res.status}`
    // Check for duplicate order (idempotency) — Printful returns 400 with "Order with this external_id already exists"
    if (errorMessage.includes("external_id")) {
      // Already submitted — look up and return the existing order
      const existing = await fetch(`${BASE_URL}/orders/@${externalId}`, {
        headers: { Authorization: AUTH },
      })
      const existingData = await existing.json() as { result: PrintfulOrderResult }
      return existingData.result
    }
    throw new Error(`Printful order submission failed: ${errorMessage}`)
  }

  return data.result!
}
