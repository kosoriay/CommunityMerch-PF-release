'use client'

import { useActionState, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DISPUTE_WINDOW_DAYS } from "@/lib/order-pii"
import type { AnonymizeFormState } from "./_actions"

type Props = {
  orderId: string
  anonymizedAt: Date | null
  /** Anything before this is past the dispute window and needs no forcing. */
  withinDisputeWindow: boolean
  action: (prev: AnonymizeFormState, formData: FormData) => Promise<AnonymizeFormState>
}

/**
 * Erasing a buyer's details on request, ahead of the retention window.
 *
 * Irreversible, so the dispute window is a real barrier rather than a warning:
 * getting past it means ticking the box and typing the order id, because a
 * refund in that period needs the identity this destroys.
 */
export function PrivacyPanel({ orderId, anonymizedAt, withinDisputeWindow, action }: Props) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState<AnonymizeFormState, FormData>(
    action,
    undefined
  )

  if (anonymizedAt) {
    return (
      <div className="bg-white rounded-lg border">
        <div className="px-4 py-3 border-b">
          <h2 className="font-semibold text-sm">Buyer privacy</h2>
        </div>
        <div className="px-4 py-4 text-sm text-muted-foreground">
          The buyer&apos;s details were cleared on {anonymizedAt.toLocaleDateString()}. The
          amount and campaign are unchanged.
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border">
      <div className="px-4 py-3 border-b">
        <h2 className="font-semibold text-sm">Buyer privacy</h2>
      </div>
      <div className="px-4 py-4 space-y-3">
        <p className="text-sm text-muted-foreground">
          Details are cleared automatically once the retention window closes. Clear them now
          only on the buyer&apos;s request. The name, email, address and tracking number are
          erased for good; the amount and campaign stay.
        </p>

        {state?.error && (
          <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
            {state.error}
          </div>
        )}
        {state?.success && (
          <div className="rounded border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-900">
            {state.success}
          </div>
        )}

        {!open ? (
          <Button variant="outline" onClick={() => setOpen(true)}>
            Clear buyer details
          </Button>
        ) : (
          <form action={formAction} className="space-y-3">
            {withinDisputeWindow && (
              <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2 space-y-2">
                <p className="text-sm text-amber-900">
                  This order changed less than {DISPUTE_WINDOW_DAYS} days ago. A refund in
                  that window needs the buyer&apos;s details, and this erases them.
                </p>
                <label className="flex items-center gap-2 text-sm text-amber-900">
                  <input type="checkbox" name="force" />
                  Erase anyway
                </label>
                <div>
                  <Label htmlFor="confirmation">
                    Type <span className="font-mono">{orderId}</span> to confirm
                  </Label>
                  <Input id="confirmation" name="confirmation" autoComplete="off" className="mt-1" />
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <Button type="submit" disabled={pending}>
                {pending ? "Clearing…" : "Clear buyer details"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
