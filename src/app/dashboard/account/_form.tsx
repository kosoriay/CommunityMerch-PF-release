"use client"

import { useActionState } from "react"
import { updateAccountAction } from "./_actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type State = { error?: string; success?: boolean } | undefined

export function AccountForm({ initialName }: { initialName: string }) {
  const [state, action, pending] = useActionState<State, FormData>(updateAccountAction, undefined)

  return (
    <form action={action} className="space-y-4">
      {state?.error && (
        <div className="text-sm text-red-600" role="alert">{state.error}</div>
      )}
      {state?.success && (
        <div className="text-sm text-green-600" role="status">Saved.</div>
      )}
      <div className="space-y-1">
        <Label htmlFor="name">Your name</Label>
        <Input id="name" name="name" defaultValue={initialName} required maxLength={80} />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : "Save"}
      </Button>
    </form>
  )
}
