"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { registerPrintfulWebhooksIfNeeded, type WebhookSyncResult } from "@/lib/printful-webhook-sync"

// 既存の discount-codes/_actions.ts・orgs/[orgId]/_actions.ts・staff/_actions.ts・
// orders/[orderId]/_actions.ts と同じ4行のガード。共有ヘルパーは存在しない
// （設計書との差分 Δ4）— この慣行に合わせ、ここでも private にもう1つ定義する。
async function requirePlatformAdmin() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (session?.user.platformRole !== "platform_admin") redirect("/admin/dashboard")
  return session
}

export type WebhookSyncActionState = { result?: WebhookSyncResult; error?: string }

/**
 * 手動の即時トリガー（設計 §3.8・D2）。cron と同じ registerPrintfulWebhooksIfNeeded
 * を呼ぶだけの薄い層 — キルスイッチ（D7）もここで自動的に効く。
 *
 * ここでは alertPrintfulStatusProblems を呼ばない — retryFulfillmentAction が
 * notifyOnFailure: false にしているのと同じ理由（運営者は今まさに画面を見ている）。
 */
export async function registerPrintfulWebhooksAction(
  _prev: WebhookSyncActionState | undefined
): Promise<WebhookSyncActionState> {
  await requirePlatformAdmin()
  try {
    const result = await registerPrintfulWebhooksIfNeeded(new Date())
    return { result }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
}
