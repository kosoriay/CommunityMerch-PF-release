"use client"

import { useActionState } from "react"
import { Button, buttonVariants } from "@/components/ui/button"
import Link from "next/link"
import { ProductSelector, type ProductSelection } from "@/components/campaign/product-selector"
import { defaultColorFor } from "@/lib/cart-options"
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
  initialDisplayMode: "percent_only" | "show_amount"
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
  initialDisplayMode,
  initialColors,
  catalog,
}: Props) {
  const [state, formAction, pending] = useActionState(action, undefined)

  // "White" は7商品で誤りになる（設計 §3.2）。カタログ行が引けない場合は
  // `[]`（`["White"]` を捏造しない）。
  function fallbackColorsFor(variantId: string): string[] {
    const color = defaultColorFor(catalog.find((c) => c.id === variantId))
    return color ? [color] : []
  }

  const initial: Partial<ProductSelection> = {
    selectedIds: initialSelectedIds,
    retailPrices: Object.fromEntries(
      Object.entries(initialPrices).map(([k, v]) => [k, (v / 100).toFixed(2)])
    ),
    selectedColors: Object.fromEntries(
      initialSelectedIds.map((id) => [id, initialColors?.[id] ?? fallbackColorsFor(id)])
    ),
    goalDollars: initialGoal ? String(initialGoal / 100) : "",
    deadline: initialDeadline ? initialDeadline.toISOString().split("T")[0] : "",
  }

  return (
    <form action={formAction} className="space-y-8">
      {state?.error && (
        <div className="text-sm text-red-600" role="alert">{state.error}</div>
      )}

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">What supporters see</legend>
        <p className="text-sm text-muted-foreground">
          The percentage of your goal is always shown. This controls whether the dollar
          amounts appear alongside it.
        </p>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="radio"
            name="amountDisplayMode"
            value="percent_only"
            defaultChecked={initialDisplayMode !== "show_amount"}
            className="mt-1"
          />
          <span>
            <span className="font-medium">Percentage only</span>
            <span className="block text-muted-foreground">
              Best when people are buying a product. &ldquo;73% of goal&rdquo;
            </span>
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="radio"
            name="amountDisplayMode"
            value="show_amount"
            defaultChecked={initialDisplayMode === "show_amount"}
            className="mt-1"
          />
          <span>
            <span className="font-medium">Show amounts too</span>
            <span className="block text-muted-foreground">
              Best when you are raising toward something specific — &ldquo;only $166 to
              go&rdquo; drives sharing. Amounts shown are your organization&rsquo;s share,
              never your costs or fees.
            </span>
          </span>
        </label>
      </fieldset>

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
