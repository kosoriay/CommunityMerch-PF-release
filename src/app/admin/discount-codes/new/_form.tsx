"use client"

import { useActionState } from "react"
import { createCodeAction } from "../_actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"

export function NewDiscountCodeForm() {
  const [state, action, pending] = useActionState(createCodeAction, undefined)

  return (
    <div className="max-w-md space-y-6">
      <h1 className="text-2xl font-bold">New Discount Code</h1>

      <form action={action} className="space-y-4">
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

        <div className="space-y-1">
          <Label>Code</Label>
          <Input name="code" placeholder="LAUNCH2026" className="uppercase" required />
          <p className="text-xs text-muted-foreground">Auto-uppercased. Orgs enter this during onboarding.</p>
        </div>

        <div className="space-y-1">
          <Label>Discount Type</Label>
          <select name="discountType" className="w-full border rounded-md px-3 py-2 text-sm" required>
            <option value="fee_percentage">Fee Percentage (reduce the 9% platform fee)</option>
            <option value="fee_waiver">Fee Waiver (0% fee for N campaigns)</option>
          </select>
        </div>

        <div className="space-y-1">
          <Label>Discount Value (%)</Label>
          <Input name="discountValue" type="number" min={1} max={100} placeholder="100" required />
          <p className="text-xs text-muted-foreground">
            fee_percentage: e.g. 20 = 20% off the fee (9% → 7.2%). fee_waiver: always 100.
          </p>
        </div>

        <div className="space-y-1">
          <Label>Max Uses (orgs)</Label>
          <Input name="maxUses" type="number" min={1} placeholder="50 (leave blank for unlimited)" />
        </div>

        <div className="space-y-1">
          <Label>Campaign Limit per Org</Label>
          <Input name="campaignLimit" type="number" min={1} placeholder="(leave blank for unlimited)" />
          <p className="text-xs text-muted-foreground">For fee_waiver: how many campaigns per org get the free rate.</p>
        </div>

        <div className="space-y-1">
          <Label>Expiry Date</Label>
          <Input name="expiresAt" type="date" />
        </div>

        <div className="flex gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? "Creating..." : "Create Code"}
          </Button>
          <Link href="/admin/discount-codes">
            <Button type="button" variant="outline">Cancel</Button>
          </Link>
        </div>
      </form>
    </div>
  )
}
