"use client"

import { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  PRESET_PACKS,
  calculateMargin,
  itemsNeededForGoal,
  suggestedRetailCents,
  type PresetPackId,
} from "@/lib/printful-catalog"
import { formatCents } from "@/lib/format"
import type { CatalogItem } from "@/lib/catalog-utils"

export type ProductSelection = {
  selectedIds: string[]
  retailPrices: Record<string, string>
  selectedColors: Record<string, string[]>
  goalDollars: string
  deadline: string
}

type Props = {
  catalog: CatalogItem[]
  initial?: Partial<ProductSelection>
  onSelectionChange?: (s: ProductSelection) => void
}

export function ProductSelector({ catalog, initial, onSelectionChange }: Props) {
  const [selectedIds, setSelectedIds] = useState<string[]>(initial?.selectedIds ?? [])
  const [retailPrices, setRetailPrices] = useState<Record<string, string>>(initial?.retailPrices ?? {})
  const [selectedColors, setSelectedColors] = useState<Record<string, string[]>>(initial?.selectedColors ?? {})
  const [goalDollars, setGoalDollars] = useState<string>(initial?.goalDollars ?? "")
  const [deadline, setDeadline] = useState<string>(initial?.deadline ?? "")

  useEffect(() => {
    onSelectionChange?.({ selectedIds, retailPrices, selectedColors, goalDollars, deadline })
  }, [selectedIds, retailPrices, selectedColors, goalDollars, deadline, onSelectionChange])

  function selectPack(packId: PresetPackId) {
    const newIds = PRESET_PACKS[packId].variantIds
    setSelectedIds([...newIds])
    setSelectedColors(Object.fromEntries(newIds.map((id) => [id, ["White"]])))
  }

  function toggleVariant(variantId: string) {
    setSelectedIds((prev) => {
      if (prev.includes(variantId)) {
        setSelectedColors((c) => { const n = { ...c }; delete n[variantId]; return n })
        return prev.filter((id) => id !== variantId)
      }
      if (prev.length >= 5) return prev
      setSelectedColors((c) => ({ ...c, [variantId]: ["White"] }))
      return [...prev, variantId]
    })
  }

  function toggleColor(variantId: string, colorName: string) {
    setSelectedColors((prev) => {
      const current = prev[variantId] ?? ["White"]
      const next = current.includes(colorName)
        ? current.filter((c) => c !== colorName)
        : [...current, colorName]
      return { ...prev, [variantId]: next.length > 0 ? next : current }
    })
  }

  // Calculate min profit across selected products for items-needed display
  const profits = selectedIds.map((id) => {
    const item = catalog.find((c) => c.id === id)
    if (!item) return 0
    const retailStr = retailPrices[id] ?? (suggestedRetailCents(item.podCostCents) / 100).toFixed(2)
    const retailCents = Math.round(parseFloat(retailStr || "0") * 100)
    if (retailCents <= 0) return 0
    return calculateMargin(retailCents, item.podCostCents).profitCents
  })
  const minProfit = profits.length > 0 ? Math.min(...profits) : 0
  const goalCents = goalDollars && parseFloat(goalDollars) > 0 ? Math.round(parseFloat(goalDollars) * 100) : null

  return (
    <div className="space-y-8">
      {/* Preset packs */}
      <div className="space-y-3">
        <Label className="text-base font-semibold">Start with a preset</Label>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(Object.keys(PRESET_PACKS) as PresetPackId[]).map((packId) => (
            <button
              key={packId}
              type="button"
              onClick={() => selectPack(packId)}
              className="rounded-lg border p-3 text-left hover:border-blue-500 transition-colors text-sm"
            >
              <p className="font-medium">{PRESET_PACKS[packId].name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{PRESET_PACKS[packId].description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Product list with margin calculator */}
      <div className="space-y-3">
        <Label className="text-base font-semibold">Products & pricing</Label>
        <p className="text-sm text-muted-foreground">Select up to 5 products and set a retail price for each.</p>
        <div className="divide-y border rounded-lg">
          {catalog.map((item) => {
            const isSelected = selectedIds.includes(item.id)
            const retailStr = retailPrices[item.id] ?? (suggestedRetailCents(item.podCostCents) / 100).toFixed(2)
            const retailCents = Math.round(parseFloat(retailStr || "0") * 100)
            const margin = isSelected && retailCents > 0
              ? calculateMargin(retailCents, item.podCostCents)
              : null

            return (
              <div key={item.id} className={`p-4 ${isSelected ? "bg-blue-50" : ""}`}>
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id={`variant-${item.id}`}
                    name="variantIds"
                    value={item.id}
                    checked={isSelected}
                    onChange={() => toggleVariant(item.id)}
                    className="mt-1"
                  />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.catalogImageUrl}
                    alt={item.name}
                    className="w-12 h-12 object-contain rounded border bg-white flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <label htmlFor={`variant-${item.id}`} className="font-medium text-sm cursor-pointer">
                      {item.name}
                    </label>
                    <p className="text-xs text-muted-foreground">
                      {item.description} · Production cost: {formatCents(item.podCostCents)}
                    </p>

                    {isSelected && (
                      <div className="mt-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <Label htmlFor={`price-${item.id}`} className="text-xs w-24 shrink-0">
                            Retail price
                          </Label>
                          <div className="flex items-center">
                            <span className="text-sm px-2 py-1 border border-r-0 rounded-l-md bg-slate-100">$</span>
                            <Input
                              id={`price-${item.id}`}
                              name={`retailPrice_${item.id}`}
                              type="number"
                              min="1"
                              max="200"
                              step="0.01"
                              value={retailStr}
                              onChange={(e) =>
                                setRetailPrices((prev) => ({ ...prev, [item.id]: e.target.value }))
                              }
                              className="w-24 rounded-l-none"
                            />
                          </div>
                        </div>
                        {margin && (
                          <div className="text-xs space-y-0.5 pl-6">
                            <p className="text-muted-foreground">
                              Production cost (+10% safety buffer): {formatCents(margin.podWithBufferCents)}
                            </p>
                            <p className="text-muted-foreground">
                              Platform fee (9%): {formatCents(margin.platformFeeCents)}
                            </p>
                            <p className="text-muted-foreground">
                              Payment processing: {formatCents(margin.stripeFeesCents)}
                            </p>
                            <p className="text-muted-foreground">
                              Shipping: paid by the buyer at checkout — does not affect your profit
                            </p>
                            <p className={`font-semibold ${margin.profitCents < 0 ? "text-red-600" : "text-green-700"}`}>
                              Your profit per item: {formatCents(margin.profitCents)}
                            </p>
                            {margin.profitCents >= 0 && margin.profitCents < 300 && (
                              <p className="text-yellow-600">⚠ Low margin. Consider pricing $25–$32 for best results.</p>
                            )}
                          </div>
                        )}
                        {/* Color selection */}
                        <div className="mt-3 pl-6">
                          <p className="text-xs text-muted-foreground mb-1.5">Available colors:</p>
                          <div className="flex flex-wrap gap-x-3 gap-y-2">
                            {item.availableColors.map((color) => {
                              const isColorSelected = (selectedColors[item.id] ?? ["White"]).includes(color.name)
                              return (
                                <label
                                  key={color.name}
                                  className="flex items-center gap-1.5 cursor-pointer select-none"
                                >
                                  <input
                                    type="checkbox"
                                    name={`colors_${item.id}`}
                                    value={color.name}
                                    checked={isColorSelected}
                                    onChange={() => toggleColor(item.id, color.name)}
                                    className="sr-only"
                                  />
                                  <span
                                    className={`w-4 h-4 rounded-full border-2 inline-block flex-shrink-0 transition-all ${
                                      isColorSelected ? "border-blue-500 scale-110" : "border-gray-300"
                                    }`}
                                    style={{ backgroundColor: color.hex }}
                                    title={color.name}
                                  />
                                  <span className="text-xs text-gray-700">{color.name}</span>
                                </label>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Goal + deadline */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="goalAmount">Fundraising goal (optional)</Label>
          <div className="flex items-center">
            <span className="text-sm px-2 py-1 border border-r-0 rounded-l-md bg-slate-100">$</span>
            <Input
              id="goalAmount"
              name="goalAmount"
              type="number"
              min="1"
              step="1"
              value={goalDollars}
              onChange={(e) => setGoalDollars(e.target.value)}
              className="rounded-l-none"
              placeholder="500"
            />
          </div>
          {selectedIds.length > 0 && minProfit > 0 && goalCents && (
            <p className="text-xs text-muted-foreground">
              ~{itemsNeededForGoal(goalCents, minProfit)} items needed to reach goal
            </p>
          )}
        </div>
        <div className="space-y-1">
          <Label htmlFor="deadline">Campaign deadline (optional)</Label>
          <Input
            id="deadline"
            name="deadline"
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
        </div>
      </div>
    </div>
  )
}
