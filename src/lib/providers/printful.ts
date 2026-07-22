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
export async function submitPrintfulOrder(
  orderId: string,
  recipient: PrintfulRecipient,
  items: PrintfulOrderItem[]
): Promise<PrintfulOrderResult> {
  const body = {
    external_id: orderId,
    shipping: "STANDARD",
    recipient,
    items,
  }

  const res = await fetch(`${BASE_URL}/orders`, {
    method: "POST",
    headers: {
      Authorization: AUTH,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })

  const data = await res.json() as { code: number; result?: PrintfulOrderResult; error?: string }

  if (!res.ok) {
    // Check for duplicate order (idempotency) — Printful returns 400 with "Order with this external_id already exists"
    if (data.error?.includes("external_id")) {
      // Already submitted — look up and return the existing order
      const existing = await fetch(`${BASE_URL}/orders/@${orderId}`, {
        headers: { Authorization: AUTH },
      })
      const existingData = await existing.json() as { result: PrintfulOrderResult }
      return existingData.result
    }
    throw new Error(`Printful order submission failed: ${data.error ?? res.status}`)
  }

  return data.result!
}
