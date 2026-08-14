'use client'

import { useActionState, useState } from "react"
import { Button } from "@/components/ui/button"
import { refundOrderAction, type RefundFormState } from "./_actions"

type Props = {
  orderId: string
  printfulOrderId: number | null
  buyerReceives: string
  organizationReturns: string
  platformAbsorbs: string
  orgName: string
}

export function RefundPanel({
  orderId,
  printfulOrderId,
  buyerReceives,
  organizationReturns,
  platformAbsorbs,
  orgName,
}: Props) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState<RefundFormState | undefined, FormData>(
    refundOrderAction.bind(null, orderId),
    undefined
  )

  if (state?.success) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
        {state.success}
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border">
      <div className="px-4 py-3 border-b">
        <h2 className="font-semibold text-sm">Resolving a problem</h2>
      </div>

      {/* Replacement first: a Printful reprint for a genuine defect costs
          neither the platform nor the organization anything, and moves no
          money at all. Refunding is the expensive fallback. */}
      <div className="px-4 py-4 border-b space-y-2">
        <p className="text-sm font-medium">1. Request a free replacement</p>
        <p className="text-sm text-muted-foreground">
          For a misprint, damage, or defect reported within 30 days of delivery, Printful
          reprints at their expense. Nothing is charged to you or {orgName}, and no money
          moves. Ask the buyer for a photo, then raise the claim on the Printful order.
        </p>
        {printfulOrderId ? (
          <a
            href={`https://www.printful.com/dashboard/order/${printfulOrderId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-sm text-blue-600 hover:underline"
          >
            Open this order in Printful ↗
          </a>
        ) : (
          <p className="text-sm text-muted-foreground">
            This order was never submitted to Printful, so there is nothing to reprint.
          </p>
        )}
      </div>

      <div className="px-4 py-4 space-y-3">
        <p className="text-sm font-medium">2. Refund</p>
        <p className="text-sm text-muted-foreground">
          Only when a replacement cannot resolve it. A refund does not return the production
          cost or the payment processing fee.
        </p>

        <dl className="text-sm rounded border bg-slate-50 divide-y">
          <div className="flex justify-between px-3 py-2">
            <dt className="text-muted-foreground">Buyer receives</dt>
            <dd className="font-medium">{buyerReceives}</dd>
          </div>
          <div className="flex justify-between px-3 py-2">
            <dt className="text-muted-foreground">Recovered from {orgName}</dt>
            <dd className="font-medium">{organizationReturns}</dd>
          </div>
          <div className="flex justify-between px-3 py-2">
            <dt className="text-muted-foreground">You absorb (not recoverable)</dt>
            <dd className="font-medium text-red-700">{platformAbsorbs}</dd>
          </div>
        </dl>

        {!open ? (
          <Button variant="outline" onClick={() => setOpen(true)}>
            Refund this order
          </Button>
        ) : (
          <form action={formAction} className="space-y-3">
            <div>
              <label htmlFor="reason" className="text-sm font-medium">
                Reason
              </label>
              <input
                id="reason"
                name="reason"
                required
                placeholder="e.g. Misprinted, replacement not possible"
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Recorded against the order for reconciliation against Stripe.
              </p>
            </div>

            {state?.error && (
              <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                {state.error}
              </div>
            )}

            {state?.needsConfirmation && (
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" name="acknowledgeShortfall" className="mt-1" />
                <span>
                  I understand {orgName}&apos;s balance will go negative and Stripe will
                  recover it from their future sales.
                </span>
              </label>
            )}

            <div className="flex gap-2">
              <Button type="submit" disabled={pending}>
                {pending ? "Refunding…" : "Confirm refund"}
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
