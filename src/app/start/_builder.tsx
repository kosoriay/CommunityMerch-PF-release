"use client"

import { useCallback, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ProductSelector, type ProductSelection } from "@/components/campaign/product-selector"
import { savePreviewDraft } from "@/lib/preview-draft"
import type { CatalogItem } from "@/lib/catalog-db"

export function PreviewBuilder({ catalog }: { catalog: CatalogItem[] }) {
  const router = useRouter()
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const selectionRef = useRef<ProductSelection>({
    selectedIds: [], retailPrices: {}, selectedColors: {}, goalDollars: "", deadline: "",
  })

  // Stable callback: only writes to a ref (no state set), so it never changes
  // identity across renders. ProductSelector's internal effect depends on
  // this callback, so a new inline function every render would re-fire it
  // on every render — see Task 1 review.
  const handleSelectionChange = useCallback((s: ProductSelection) => {
    selectionRef.current = s
  }, [])

  function handleSave() {
    setError(null)
    const trimmed = name.trim()
    if (trimmed.length < 2) { setError("Give your campaign a name first."); return }
    const sel = selectionRef.current
    if (sel.selectedIds.length === 0) { setError("Select at least one product."); return }

    const nonce = savePreviewDraft({
      name: trimmed,
      products: sel.selectedIds.map((id) => ({
        variantId: id,
        retailDollars: sel.retailPrices[id] ?? "28.00",
        colors: sel.selectedColors[id] ?? ["White"],
      })),
      goalDollars: sel.goalDollars,
      deadline: sel.deadline,
    })
    const callbackUrl = `/onboarding?d=${nonce}`
    router.push(`/sign-in?callbackUrl=${encodeURIComponent(callbackUrl)}`)
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Label htmlFor="campaignName">Campaign name</Label>
        <Input id="campaignName" value={name} onChange={(e) => setName(e.target.value)}
               placeholder="e.g. Sakura Elementary 6th Grade" />
      </div>
      <ProductSelector catalog={catalog} onSelectionChange={handleSelectionChange} />
      {error && <div className="text-sm text-red-600" role="alert">{error}</div>}
      <Button type="button" onClick={handleSave}>Save &amp; sign up →</Button>
    </div>
  )
}
