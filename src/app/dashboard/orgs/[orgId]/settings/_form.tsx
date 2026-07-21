"use client"

import { useActionState } from "react"
import { updateOrgAction } from "./_actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type State = { error?: string; success?: boolean } | undefined

export function OrgSettingsForm({ orgId, initialName }: { orgId: string; initialName: string }) {
  const action = updateOrgAction.bind(null, orgId)
  const [state, formAction, pending] = useActionState<State, FormData>(action, undefined)

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <div className="text-sm text-red-600" role="alert">{state.error}</div>
      )}
      {state?.success && (
        <div className="text-sm text-green-600" role="status">Saved.</div>
      )}
      <div className="space-y-1">
        <Label htmlFor="name">Organization name</Label>
        <Input id="name" name="name" defaultValue={initialName} required minLength={2} maxLength={80} />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : "Save"}
      </Button>
    </form>
  )
}
