"use client"

import { useActionState } from "react"
import Link from "next/link"
import { createOrgAction } from "./_actions"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type State = { error?: string } | undefined

export default function NewOrgPage() {
  const [state, action, pending] = useActionState<State, FormData>(createOrgAction, undefined)

  return (
    <div className="max-w-md mx-auto mt-8">
      <Card>
        <CardHeader>
          <CardTitle>New Organization</CardTitle>
          <CardDescription>
            Create a new organization. You&apos;ll be the admin and can invite members later.
          </CardDescription>
          <p className="text-sm text-muted-foreground mt-1">
            Create one organization per fundraising team. If different groups will manage
            separate campaigns independently, give each group their own organization.
          </p>
        </CardHeader>
        <CardContent>
          <form action={action} className="space-y-4">
            {state?.error && (
              <div className="text-sm text-red-600" role="alert">{state.error}</div>
            )}
            <div className="space-y-1">
              <Label htmlFor="name">Organization name</Label>
              <Input
                id="name"
                name="name"
                placeholder="e.g. Lincoln High Spring 2026 Team"
                required
                minLength={2}
                maxLength={80}
              />
            </div>
            <div className="flex gap-3">
              <Button type="submit" disabled={pending}>
                {pending ? "Creating..." : "Create Organization"}
              </Button>
              <Link href="/dashboard" className={buttonVariants({ variant: "outline" })}>
                Cancel
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
