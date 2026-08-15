'use client'

import { useActionState, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { deleteOrgAction, closeOrgAction, type DangerZoneState } from "./_actions"

type Props = {
  orgId: string
  orgName: string
  /** Everything preventing deletion, already explained for the reader. */
  blockerReasons: string[]
  /** Orders exist, so closing is the right action rather than a fallback. */
  hasOrders: boolean
  isClosed: boolean
}

/**
 * Deleting versus closing is decided by whether money has changed hands, not
 * by preference. An organization that has taken even one order has a buyer, a
 * payment and a tax record attached to it, so it is retired rather than erased.
 */
export function DangerZone({ orgId, orgName, blockerReasons, hasOrders, isClosed }: Props) {
  const canDelete = blockerReasons.length === 0
  const [open, setOpen] = useState(false)
  // Orders mean closing is correct. Other blockers — a live campaign, money
  // still in the payout account — are temporary, so neither action is offered
  // until they are cleared.
  const offerClose = hasOrders
  const action = canDelete ? deleteOrgAction : closeOrgAction
  const [state, formAction, pending] = useActionState<DangerZoneState, FormData>(
    action.bind(null, orgId),
    undefined
  )

  if (isClosed) {
    return (
      <div className="rounded-lg border border-slate-300 bg-slate-50 p-4">
        <p className="text-sm font-medium">This organization is closed</p>
        <p className="text-sm text-muted-foreground mt-1">
          Campaigns are no longer public and new orders are refused. Your records and past
          orders are unchanged. Contact support to reopen it.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-red-300">
      <div className="px-4 py-3 border-b border-red-200 bg-red-50">
        <h2 className="font-semibold text-red-900 text-sm">Danger zone</h2>
      </div>

      <div className="px-4 py-4 space-y-3">
        {canDelete ? (
          <>
            <p className="text-sm font-medium">Delete this organization</p>
            <p className="text-sm text-muted-foreground">
              {orgName} has never taken an order, so it can be removed completely — members,
              invitations, campaigns and uploaded designs. This cannot be undone.
            </p>
          </>
        ) : offerClose ? (
          <>
            <p className="text-sm font-medium">Close this organization</p>
            <p className="text-sm text-muted-foreground">
              Closing stops new orders and removes campaigns from public view. Your history
              remains visible to you, and support can reopen it.
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-medium">Not ready to delete</p>
            <p className="text-sm text-muted-foreground">
              Resolve the following first. These are temporary — once cleared, deletion becomes
              available.
            </p>
          </>
        )}

        {blockerReasons.length > 0 && (
          <ul className="space-y-1 text-sm text-red-900 list-disc pl-5">
            {blockerReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        )}

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

        {!canDelete && !offerClose ? null : !open ? (
          <Button variant="outline" onClick={() => setOpen(true)}>
            {canDelete ? "Delete organization" : "Close organization"}
          </Button>
        ) : (
          <form action={formAction} className="space-y-3">
            <div>
              <label htmlFor="confirmation" className="text-sm font-medium">
                Type <span className="font-mono">{orgName}</span> to confirm
              </label>
              <Input id="confirmation" name="confirmation" autoComplete="off" className="mt-1" />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={pending}>
                {pending
                  ? canDelete
                    ? "Deleting…"
                    : "Closing…"
                  : canDelete
                    ? "Permanently delete"
                    : "Close organization"}
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
