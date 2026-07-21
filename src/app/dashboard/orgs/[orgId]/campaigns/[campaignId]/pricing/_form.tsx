"use client"

import { useActionState } from "react"
import { Button, buttonVariants } from "@/components/ui/button"
import Link from "next/link"
import { ProductSelector, type ProductSelection } from "@/components/campaign/product-selector"
import type { CatalogItem } from "@/lib/catalog-db"

type ActionState = { error?: string } | undefined

type Props = {
  orgId: string
  campaignId: string
  action: (state: ActionState, formData: FormData) => Promise<ActionState>
  initialSelectedIds: string[]
  initialPrices: Record<string, number>
  initialGoal: number | null
  initialDeadline: Date | null
  initialColors?: Record<string, string[]>
  catalog: CatalogItem[]
}

export function PricingForm({
  orgId,
  campaignId,
  action,
  initialSelectedIds,
  initialPrices,
  initialGoal,
  initialDeadline,
  initialColors,
  catalog,
}: Props) {
  const [state, formAction, pending] = useActionState(action, undefined)

  const initial: Partial<ProductSelection> = {
    selectedIds: initialSelectedIds,
    retailPrices: Object.fromEntries(
      Object.entries(initialPrices).map(([k, v]) => [k, (v / 100).toFixed(2)])
    ),
    selectedColors: Object.fromEntries(
      initialSelectedIds.map((id) => [id, initialColors?.[id] ?? ["White"]])
    ),
    goalDollars: initialGoal ? String(initialGoal / 100) : "",
    deadline: initialDeadline ? initialDeadline.toISOString().split("T")[0] : "",
  }

  return (
    <form action={formAction} className="space-y-8">
      {state?.error && (
        <div className="text-sm text-red-600" role="alert">{state.error}</div>
      )}

      {/* Hidden amountDisplayMode — always percent_only in Plan 3 */}
      <input type="hidden" name="amountDisplayMode" value="percent_only" />

      <ProductSelector catalog={catalog} initial={initial} />

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save & Continue →"}
        </Button>
        <Link
          href={`/dashboard/orgs/${orgId}/campaigns/${campaignId}/design`}
          className={buttonVariants({ variant: "outline" })}
        >
          ← Back
        </Link>
      </div>
    </form>
  )
}
