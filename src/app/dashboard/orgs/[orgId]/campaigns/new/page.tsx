"use client"

import { useActionState } from "react"
import { useParams } from "next/navigation"
import { createCampaignAction } from "./_actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"

type State = { error?: string } | undefined

export default function NewCampaignPage() {
  const { orgId } = useParams<{ orgId: string }>()
  const boundAction = createCampaignAction.bind(null, orgId)
  const [state, action, pending] = useActionState<State, FormData>(boundAction, undefined)

  return (
    <div className="max-w-md mx-auto mt-8">
      <Card>
        <CardHeader>
          <CardTitle>New Campaign</CardTitle>
          <CardDescription>
            Give your campaign a name. You&apos;ll add design and pricing in the next steps.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={action} className="space-y-4">
            {state?.error && (
              <div className="text-sm text-red-600" role="alert">
                {state.error}
              </div>
            )}
            <div className="space-y-1">
              <Label htmlFor="title">Campaign name</Label>
              <Input
                id="title"
                name="title"
                placeholder="Lincoln Elementary PTA Spring 2026"
                required
                minLength={2}
                maxLength={100}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              All campaigns under this organization share the same team and bank account.
              If a different group will manage this campaign,{" "}
              <Link href="/dashboard/orgs/new" className="underline">
                create a new organization
              </Link>{" "}
              for them first.
            </p>
            <div className="flex gap-3">
              <Button type="submit" disabled={pending}>
                {pending ? "Creating..." : "Create Campaign"}
              </Button>
              <Link
                href={`/dashboard/orgs/${orgId}/campaigns`}
                className={buttonVariants({ variant: "outline" })}
              >
                Cancel
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
