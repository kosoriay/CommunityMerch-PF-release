'use client'

import { useActionState, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  retryFulfillmentAction,
  updateAddressAction,
  type RetryFormState,
  type AddressFormState,
} from "./_actions"

type Address = {
  line1?: string
  line2?: string
  city?: string
  state?: string
  postal_code?: string
}

type Props = {
  orderId: string
  error: string
  attempts: number
  buyerName: string | null
  address: Address | null
}

/**
 * Recovery for a paid order that never reached production.
 *
 * Retry is offered first because most causes are transient or already fixed
 * elsewhere. Editing the address is offered alongside it because a rejected
 * recipient is the most common cause that retry alone cannot clear.
 */
export function RecoveryPanel({ orderId, error, attempts, buyerName, address }: Props) {
  const [editing, setEditing] = useState(false)
  const [retryState, retry, retrying] = useActionState<RetryFormState | undefined, FormData>(
    () => retryFulfillmentAction(orderId, undefined),
    undefined
  )
  const [addressState, saveAddress, saving] = useActionState<
    AddressFormState | undefined,
    FormData
  >(updateAddressAction.bind(null, orderId), undefined)

  const looksLikeAddressProblem = /address|state|zip|postal|recipient/i.test(error)
  const looksLikeAuthProblem = /401|unauthor|token|api key/i.test(error)

  return (
    <div className="rounded-lg border border-red-300 bg-red-50">
      <div className="px-4 py-3 border-b border-red-200">
        <h2 className="font-semibold text-red-900 text-sm">Not sent to production</h2>
        <p className="text-sm text-red-800 mt-1">
          The buyer has paid. Nothing ships until this is resolved.
        </p>
      </div>

      <div className="px-4 py-4 space-y-4">
        <div>
          <p className="text-xs text-red-700 uppercase tracking-wide">Error</p>
          <p className="text-sm text-red-900 break-words mt-1">{error}</p>
          <p className="text-xs text-red-700 mt-1">
            {attempts} {attempts === 1 ? "attempt" : "attempts"} so far
          </p>
        </div>

        {looksLikeAuthProblem && (
          <div className="rounded border border-red-300 bg-white px-3 py-2 text-sm text-red-900">
            This looks like an authorization failure. Printful tokens expire after at most two
            years, and expiry stops every order at once — check the token before retrying.
          </div>
        )}

        {retryState?.error && (
          <div className="rounded border border-red-300 bg-white px-3 py-2 text-sm text-red-900">
            {retryState.error}
          </div>
        )}
        {retryState?.success && (
          <div className="rounded border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-900">
            {retryState.success}
          </div>
        )}
        {addressState?.error && (
          <div className="rounded border border-red-300 bg-white px-3 py-2 text-sm text-red-900">
            {addressState.error}
          </div>
        )}
        {addressState?.success && (
          <div className="rounded border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-900">
            {addressState.success}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <form action={retry}>
            <Button type="submit" disabled={retrying}>
              {retrying ? "Retrying…" : "Retry fulfillment"}
            </Button>
          </form>
          {!editing && (
            <Button type="button" variant="outline" onClick={() => setEditing(true)}>
              {looksLikeAddressProblem ? "Fix the address" : "Edit address"}
            </Button>
          )}
        </div>
        <p className="text-xs text-red-700">
          Retrying is safe to repeat — the print provider deduplicates on the order reference,
          so it will not print twice.
        </p>

        {editing && (
          <form action={saveAddress} className="space-y-3 border-t border-red-200 pt-4">
            <Field name="buyer_name" label="Recipient name" defaultValue={buyerName ?? ""} />
            <Field name="line1" label="Street address" defaultValue={address?.line1 ?? ""} required />
            <Field name="line2" label="Apt, suite (optional)" defaultValue={address?.line2 ?? ""} />
            <div className="grid grid-cols-3 gap-2">
              <Field name="city" label="City" defaultValue={address?.city ?? ""} required />
              <Field name="state" label="State" defaultValue={address?.state ?? ""} required placeholder="NY" />
              <Field name="postal_code" label="ZIP" defaultValue={address?.postal_code ?? ""} required />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save address"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

function Field({
  name,
  label,
  defaultValue,
  required,
  placeholder,
}: {
  name: string
  label: string
  defaultValue: string
  required?: boolean
  placeholder?: string
}) {
  return (
    <div>
      <label htmlFor={name} className="text-xs font-medium text-red-900">
        {label}
      </label>
      <input
        id={name}
        name={name}
        defaultValue={defaultValue}
        required={required}
        placeholder={placeholder}
        className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
      />
    </div>
  )
}
