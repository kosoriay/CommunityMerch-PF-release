"use client"

import { useCallback, useRef, useState, useSyncExternalStore } from "react"
import { useSearchParams } from "next/navigation"
import { useActionState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { completeOnboardingAction, type OnboardingState } from "./_actions"
import { loadPreviewDraft, clearPreviewDraft, type PreviewDraft } from "@/lib/preview-draft"

type Props = { defaultName: string; existingOrgs: { id: string; name: string }[] }

// localStorage only exists in the browser, so the draft can't be read during render on
// the server. useSyncExternalStore reads null on the server/initial hydration pass, then
// syncs to the real value right after mount — no manual setState-in-effect needed.
function noopSubscribe(): () => void {
  return () => {}
}
function getServerSnapshot(): null {
  return null
}

export function OnboardingForm({ defaultName, existingOrgs }: Props) {
  const params = useSearchParams()
  const nonce = params.get("d") ?? ""
  const [state, action, pending] = useActionState<OnboardingState, FormData>(completeOnboardingAction, undefined)
  const [useExisting, setUseExisting] = useState(existingOrgs.length > 0)

  const draftCacheRef = useRef<{ nonce: string; draft: PreviewDraft | null } | null>(null)
  const getSnapshot = useCallback(() => {
    if (draftCacheRef.current?.nonce !== nonce) {
      draftCacheRef.current = { nonce, draft: loadPreviewDraft(nonce) }
    }
    return draftCacheRef.current.draft
  }, [nonce])
  const draft = useSyncExternalStore(noopSubscribe, getSnapshot, getServerSnapshot)

  return (
    <Card className="w-full max-w-md">
      <CardHeader><CardTitle>Set up your organization</CardTitle></CardHeader>
      <CardContent>
        <form action={(fd) => { clearPreviewDraft(nonce); return action(fd) }} className="space-y-4">
          {state?.error && <div className="text-sm text-red-600" role="alert">{state.error}</div>}

          <input type="hidden" name="campaignName" value={draft?.name ?? ""} />
          <input type="hidden" name="draftProducts" value={draft ? JSON.stringify(draft.products) : ""} />
          <input type="hidden" name="goalDollars" value={draft?.goalDollars ?? ""} />
          <input type="hidden" name="deadline" value={draft?.deadline ?? ""} />

          {existingOrgs.length > 0 && (
            <div className="space-y-1">
              <Label>Organization</Label>
              <select name={useExisting ? "orgId" : "__ignore"} defaultValue={existingOrgs[0].id}
                      onChange={(e) => setUseExisting(e.target.value !== "__new")}
                      className="w-full rounded-md border px-3 py-2 text-sm">
                {existingOrgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                <option value="__new">+ Create a new organization</option>
              </select>
            </div>
          )}

          {!useExisting && (
            <div className="space-y-1">
              <Label htmlFor="orgName">Organization name</Label>
              <Input id="orgName" name="orgName" placeholder="Sakura Elementary PTA" required={!useExisting} />
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="displayName">Your name</Label>
            <Input id="displayName" name="displayName" defaultValue={defaultName} required />
          </div>

          {draft && (
            <p className="text-xs text-muted-foreground">
              We&apos;ll carry over &ldquo;{draft.name}&rdquo; and your {draft.products.length} selected product(s).
            </p>
          )}

          <Button type="submit" disabled={pending}>{pending ? "Setting up..." : "Create & continue →"}</Button>
        </form>
      </CardContent>
    </Card>
  )
}
