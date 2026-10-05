"use client"

import { useActionState } from "react"
import { Button } from "@/components/ui/button"
import { registerPrintfulWebhooksAction, type WebhookSyncActionState } from "../_actions"

/**
 * Printful webhook 登録の手動トリガー（設計 §3.8・D9）。platform_admin のみ表示。
 *
 * 🔴 生の webhook URL・secret は一切表示しない（レビューでCritical判定・
 * 2026-09-22）。表示するのは診断情報（ベースURL一致／不一致・types X/9）だけ。
 */
export function PrintfulWebhookCard() {
  const [state, action, pending] = useActionState<WebhookSyncActionState | undefined, FormData>(
    () => registerPrintfulWebhooksAction(undefined),
    undefined
  )

  return (
    <div className="bg-white rounded-lg border">
      <div className="px-4 py-3 border-b">
        <h2 className="font-semibold">Printful webhook registration</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Checks that Printful is configured to notify this app of all 9 order events, and fixes it if not.
          The daily 00:00 UTC check does this automatically — use this for an immediate check.
        </p>
      </div>
      <div className="px-4 py-4 space-y-3">
        <form action={action}>
          <Button type="submit" disabled={pending}>
            {pending ? "Checking…" : "Check & register now"}
          </Button>
        </form>
        {state?.error && (
          <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
            Could not check: {state.error}
          </div>
        )}
        {state?.result && <ResultLine result={state.result} />}
      </div>
    </div>
  )
}

function ResultLine({ result }: { result: NonNullable<WebhookSyncActionState["result"]> }) {
  if (result.kind === "up_to_date" || result.kind === "registered") {
    const d = result.diagnostic
    const headline = result.kind === "up_to_date" ? "Already registered" : "Registered just now"
    return (
      <div className="rounded border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-900">
        {headline} ({d.matchedTypes}/{d.totalTypes} types, {d.urlMatches ? "matches" : "did not match"} this app&apos;s URL).
      </div>
    )
  }
  if (result.kind === "skipped") {
    return (
      <div className="rounded border border-yellow-300 bg-yellow-50 px-3 py-2 text-sm text-yellow-900">
        Skipped: {result.reason}
      </div>
    )
  }
  if (result.kind === "unauthorized") {
    return (
      <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
        Could not check: Printful rejected the request (HTTP {result.httpStatus}). The API token may be missing
        the webhook scopes — see 00-START-HERE.md §4-3 for a scoped token that does not touch order fulfillment.
      </div>
    )
  }
  return (
    <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
      Could not register ({result.diagnostic.matchedTypes}/{result.diagnostic.totalTypes} types before this attempt): {result.message}
    </div>
  )
}
