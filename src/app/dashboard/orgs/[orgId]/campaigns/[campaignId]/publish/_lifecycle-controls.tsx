'use client'

import { useActionState, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { LifecycleState } from "./_actions"

type Props = {
  campaignTitle: string
  isClosed: boolean
  closeAction: (prev: LifecycleState, formData: FormData) => Promise<LifecycleState>
  reopenAction: (prev: LifecycleState, formData: FormData) => Promise<LifecycleState>
}

/**
 * Ending and reopening. There is deliberately no separate "cancel" — payment
 * charges and sends to print immediately, so stopping early and stopping on
 * time produce the same outcome for every order that exists.
 */
export function LifecycleControls({ campaignTitle, isClosed, closeAction, reopenAction }: Props) {
  const [open, setOpen] = useState(false)
  // One hook, not one per action: ending flips isClosed, and a second hook's
  // result would be swapped out of view in the same render that produced it.
  const [state, formAction, pending] = useActionState<LifecycleState, FormData>(
    isClosed ? reopenAction : closeAction,
    undefined
  )

  return (
    <div className="rounded-lg border border-slate-300">
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
        <h2 className="font-semibold text-sm">
          {isClosed ? "This campaign has ended" : "End this campaign"}
        </h2>
      </div>

      <div className="px-4 py-4 space-y-3">
        <p className="text-sm text-muted-foreground">
          {isClosed
            ? "The page stays online and shows your results. Reopening starts orders again."
            : "Ending stops new orders. The page stays online and shows your results, and orders already placed are still fulfilled."}
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

        {isClosed ? (
          <form action={formAction} className="space-y-3">
            <div>
              <Label htmlFor="deadline">New deadline (leave empty for no deadline)</Label>
              <Input id="deadline" name="deadline" type="date" className="mt-1" />
              <p className="text-xs text-muted-foreground mt-1">
                A deadline in the past would end the campaign again straight away.
              </p>
            </div>
            <Button type="submit" disabled={pending}>
              {pending ? "Reopening…" : "Reopen campaign"}
            </Button>
          </form>
        ) : !open ? (
          <Button variant="outline" onClick={() => setOpen(true)}>
            End campaign
          </Button>
        ) : (
          <form action={formAction} className="space-y-3">
            <div>
              <Label htmlFor="confirmation">
                Type <span className="font-mono">{campaignTitle}</span> to confirm
              </Label>
              <Input id="confirmation" name="confirmation" autoComplete="off" className="mt-1" />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={pending}>
                {pending ? "Ending…" : "End campaign"}
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
