"use client"

import { useActionState } from "react"
import { assignRoleAction } from "./_actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function AssignRoleForm() {
  const [state, action, pending] = useActionState(assignRoleAction, undefined)

  return (
    <form action={action} className="space-y-3">
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <div className="space-y-1">
        <Label>Email</Label>
        <Input name="email" type="email" placeholder="staff@example.com" required />
      </div>
      <div className="space-y-1">
        <Label>Role</Label>
        <select name="role" className="w-full border rounded-md px-3 py-2 text-sm" required>
          <option value="platform_staff">Platform Staff (read-only)</option>
          <option value="platform_admin">Platform Admin (full access)</option>
        </select>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Assigning..." : "Assign Role"}
      </Button>
    </form>
  )
}
