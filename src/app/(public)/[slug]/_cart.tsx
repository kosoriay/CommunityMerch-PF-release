"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { formatCents } from "@/lib/format"
import { getColorImageFromItem, type CatalogItem } from "@/lib/catalog-utils"
import type { CartItem } from "@/lib/orders"

const SIZES = ["XS", "S", "M", "L", "XL", "2XL"] as const

type Product = {
  id: string
  printfulVariantId: string
  retailPrice: number
  availableColors: string[]
  mockupUrl: string | null
}

type Props = {
  campaignId: string
  orgId: string
  products: Product[]
  catalog: Record<string, CatalogItem>
}

export function CampaignCart({ campaignId, orgId, products, catalog }: Props) {
  const [cart, setCart] = useState<CartItem[]>([])
  const [selectedSizes, setSelectedSizes] = useState<Record<string, string>>({})
  const [selectedQty, setSelectedQty] = useState<Record<string, number>>({})
  const [selectedColors, setSelectedColors] = useState<Record<string, string>>(
    () => Object.fromEntries(products.map((p) => [p.id, p.availableColors[0] ?? "White"]))
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function addToCart(product: Product) {
    const size = selectedSizes[product.id]
    if (!size) {
      const name = catalog[product.printfulVariantId]?.name ?? product.printfulVariantId
      setError(`Please select a size for ${name}`)
      return
    }
    const color = selectedColors[product.id] ?? product.availableColors[0] ?? "White"
    const qty = selectedQty[product.id] ?? 1
    setError(null)
    setCart((prev) => {
      const existing = prev.find(
        (i) => i.campaignProductId === product.id && i.size === size && i.color === color
      )
      if (existing) {
        return prev.map((i) =>
          i.campaignProductId === product.id && i.size === size && i.color === color
            ? { ...i, quantity: i.quantity + qty }
            : i
        )
      }
      return [
        ...prev,
        {
          campaignProductId: product.id,
          size,
          quantity: qty,
          unitPriceCents: product.retailPrice,
          color,
        },
      ]
    })
  }

  function removeFromCart(campaignProductId: string, size: string, color: string) {
    setCart((prev) =>
      prev.filter(
        (i) => !(i.campaignProductId === campaignProductId && i.size === size && i.color === color)
      )
    )
  }

  const totalCents = cart.reduce((sum, i) => sum + i.unitPriceCents * i.quantity, 0)

  async function handleCheckout() {
    if (cart.length === 0) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, orgId, items: cart }),
      })
      const data = await res.json() as { checkoutUrl?: string; error?: string }
      if (!res.ok) throw new Error(data.error ?? "Checkout failed")
      window.location.href = data.checkoutUrl!
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed")
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Product card grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {products.map((product) => {
          const catalogItem = catalog[product.printfulVariantId]
          const selectedColor = selectedColors[product.id] ?? product.availableColors[0] ?? "White"
          const catalogImageUrl = catalogItem ? getColorImageFromItem(catalogItem, selectedColor) : ""
          const displayImageUrl = product.mockupUrl ?? catalogImageUrl

          return (
            <div
              key={product.id}
              className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm"
            >
              {/* Product image */}
              <div className="bg-gray-50 h-44 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={displayImageUrl}
                  alt={catalogItem?.name ?? product.printfulVariantId}
                  className="h-40 w-40 object-contain"
                  onError={(e) => { e.currentTarget.style.display = "none" }}
                />
              </div>

              <div className="p-4 space-y-3">
                {/* Name + price */}
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-sm text-gray-900">{catalogItem?.name ?? product.printfulVariantId}</p>
                    <p className="text-xs text-gray-500">{catalogItem?.description}</p>
                  </div>
                  <p className="font-bold text-sm text-[#2E4057]">{formatCents(product.retailPrice)}</p>
                </div>

                {/* Color swatches */}
                {product.availableColors.length > 1 && (
                  <div className="flex gap-1.5 flex-wrap items-center">
                    {product.availableColors.map((colorName) => {
                      const colorData = catalogItem?.availableColors.find((c) => c.name === colorName)
                      const isSelected = selectedColor === colorName
                      return (
                        <button
                          key={colorName}
                          type="button"
                          title={colorName}
                          onClick={() =>
                            setSelectedColors((prev) => ({ ...prev, [product.id]: colorName }))
                          }
                          className={`w-5 h-5 rounded-full border-2 transition-transform ${
                            isSelected ? "border-blue-500 scale-110" : "border-gray-200"
                          }`}
                          style={{ backgroundColor: colorData?.hex ?? "#FFFFFF" }}
                        />
                      )
                    })}
                    <span className="text-xs text-gray-500">{selectedColor}</span>
                  </div>
                )}

                {/* Size selection */}
                <div className="flex gap-1 flex-wrap">
                  {SIZES.map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setSelectedSizes((prev) => ({ ...prev, [product.id]: size }))}
                      className={`px-2 py-0.5 text-xs rounded border transition-colors ${
                        selectedSizes[product.id] === size
                          ? "bg-[#2E4057] text-white border-[#2E4057]"
                          : "border-slate-200 hover:border-slate-400"
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>

                {/* Quantity + add to cart */}
                <div className="flex items-center gap-2">
                  <select
                    value={selectedQty[product.id] ?? 1}
                    onChange={(e) =>
                      setSelectedQty((prev) => ({ ...prev, [product.id]: parseInt(e.target.value) }))
                    }
                    className="border rounded px-2 py-1 text-xs"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => addToCart(product)}
                    className={`flex-1 text-xs font-medium transition-colors ${
                      selectedSizes[product.id]
                        ? "text-[#378ADD] hover:underline"
                        : "text-gray-300 cursor-not-allowed"
                    }`}
                    disabled={!selectedSizes[product.id]}
                  >
                    {selectedSizes[product.id] ? "Add to cart" : "Select a size first"}
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Cart summary */}
      {cart.length > 0 && (
        <div className="rounded-lg border-2 border-[#2E4057] bg-white p-4 space-y-3">
          <h3 className="font-semibold text-[#2E4057]">Your order</h3>
          <ul className="space-y-2">
            {cart.map((item) => {
              const product = products.find((p) => p.id === item.campaignProductId)
              const cartCatalogItem = product ? catalog[product.printfulVariantId] : null
              return (
                <li
                  key={`${item.campaignProductId}-${item.size}-${item.color}`}
                  className="flex items-center justify-between text-sm"
                >
                  <span>
                    {cartCatalogItem?.name} — {item.color} / {item.size} × {item.quantity}
                  </span>
                  <div className="flex items-center gap-3">
                    <span>{formatCents(item.unitPriceCents * item.quantity)}</span>
                    <button
                      type="button"
                      onClick={() => removeFromCart(item.campaignProductId, item.size, item.color ?? "")}
                      className="text-xs text-red-500 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
          <div className="border-t pt-2 flex justify-between font-semibold">
            <span>Total</span>
            <span>{formatCents(totalCents)}</span>
          </div>

          {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

          <Button onClick={handleCheckout} disabled={loading} className="w-full">
            {loading ? "Redirecting to payment..." : "Checkout — Pay Securely"}
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            Powered by Stripe · Secure checkout · Shipping calculated at checkout
          </p>
          <p className="text-xs text-center text-muted-foreground">
            By purchasing you agree to the{" "}
            <a href="/terms" target="_blank" rel="noopener" className="underline hover:text-foreground">
              Terms of Service
            </a>.
          </p>
        </div>
      )}

      {error && cart.length === 0 && (
        <p className="text-sm text-red-600 text-center" role="alert">{error}</p>
      )}

      {cart.length === 0 && !error && (
        <div className="text-center text-sm text-muted-foreground py-2">
          Select a size and click &quot;Add to cart&quot; to place your order.
        </div>
      )}
    </div>
  )
}
