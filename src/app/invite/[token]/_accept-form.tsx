"use client"

import { useActionState } from "react"
import { Button } from "@/components/ui/button"
import { acceptInvitationAction } from "./_actions"

type Props = { token: string }

export function AcceptForm({ token }: Props) {
  const [state, action, isPending] = useActionState(
    (_prev: { error?: string } | null, _formData: FormData) =>
      acceptInvitationAction(token),
    null
  )

  return (
    <form action={action}>
      {state?.error && (
        <p className="text-sm text-red-600 mb-3">{state.error}</p>
      )}
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Accepting…" : "Accept invitation"}
      </Button>
    </form>
  )
}
