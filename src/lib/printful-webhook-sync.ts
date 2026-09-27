import type { PrintfulWebhookConfig } from "@/lib/providers/printful"
import { getPrintfulWebhooks, replacePrintfulWebhooks, probeWebhookUrlIsReachable } from "@/lib/providers/printful"
import { isEnvConfigured } from "@/lib/platform-config"
import { PRINTFUL_WEBHOOK_EVENT_TYPES } from "@/lib/printful-status"

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false
  const setA = new Set(a)
  return b.every((t) => setA.has(t))
}

export type WebhookSyncDecision =
  | { action: "up_to_date" }
  | { action: "register" }
  | { action: "skip"; reason: string }

/**
 * 登録が必要かを判定する純粋関数（設計 §3.4。catalog-price-sync.ts の
 * decidePodCostUpdate と同じ形 — ネットワークに触らない）。
 *
 * urlIsReachable は「一致しなかった後」にだけ意味を持つ。一致していれば
 * （up_to_date）この値に関わらず登録しない — 無駄な自己 POST を避ける
 * （呼び出し側の契約。設計 §3.4・§3.5 手順5-6）。
 */
export function decideWebhookSync(
  current: PrintfulWebhookConfig | null,
  desiredUrl: string,
  desiredTypes: readonly string[],
  urlIsReachable: boolean | null
): WebhookSyncDecision {
  const matches = current !== null && current.url === desiredUrl && sameSet(current.types, desiredTypes)
  if (matches) return { action: "up_to_date" }
  if (urlIsReachable === false) {
    return { action: "skip", reason: "candidate URL did not answer as this app's webhook route" }
  }
  return { action: "register" }
}

/** D7: 既定 true。isPrintfulAutoConfirm と同じ書式 — 文字列 "false" でだけ無効化。 */
export function isPrintfulWebhookAutoRegisterEnabled(): boolean {
  return process.env.PRINTFUL_WEBHOOK_AUTO_REGISTER !== "false"
}

const REQUIRED_ENV_KEYS = ["PRINTFUL_API_KEY", "PRINTFUL_WEBHOOK_SECRET", "NEXT_PUBLIC_APP_URL"] as const

function missingEnvKeys(keys: readonly string[]): string[] {
  const configured = isEnvConfigured([...keys])
  return keys.filter((k) => !configured[k])
}

export type WebhookRegistrationDiagnostic = {
  urlMatches: boolean
  matchedTypes: number
  totalTypes: number
}

function diagnose(current: { url: string; types: string[] } | null, desiredUrl: string, desiredTypes: readonly string[]): WebhookRegistrationDiagnostic {
  const totalTypes = desiredTypes.length
  if (current === null) return { urlMatches: false, matchedTypes: 0, totalTypes }
  // ベースURLだけを比較する — ?secret= 以降は絶対に戻り値に含めない（設計 §3.8 🔴）。
  const urlMatches = current.url.split("?")[0] === desiredUrl.split("?")[0]
  const currentTypes = new Set(current.types)
  const matchedTypes = desiredTypes.filter((t) => currentTypes.has(t)).length
  return { urlMatches, matchedTypes, totalTypes }
}

export type WebhookSyncResult =
  | { kind: "up_to_date"; diagnostic: WebhookRegistrationDiagnostic }
  | { kind: "registered"; diagnostic: WebhookRegistrationDiagnostic }
  | { kind: "skipped"; reason: string }
  | { kind: "unauthorized"; httpStatus: number }
  | { kind: "register_failed"; message: string; diagnostic: WebhookRegistrationDiagnostic }

/**
 * cron と管理画面ボタンの両方が呼ぶ、唯一のオーケストレーション関数（設計 §3.5）。
 * キルスイッチ（D7）はここ1箇所でだけ判定する — 呼び出し側がどちらでも自動的に効く。
 */
export async function registerPrintfulWebhooksIfNeeded(now: Date): Promise<WebhookSyncResult> {
  void now // 現状は使わないが、将来の計測・ログ相関のためシグネチャに残す（設計 §3.5 に明記）

  const missing = missingEnvKeys(REQUIRED_ENV_KEYS)
  if (missing.length > 0) {
    return { kind: "skipped", reason: `missing environment variable(s): ${missing.join(", ")}` }
  }
  if (!isPrintfulWebhookAutoRegisterEnabled()) {
    return { kind: "skipped", reason: "disabled by PRINTFUL_WEBHOOK_AUTO_REGISTER=false" }
  }

  // NEXT_PUBLIC_APP_URL 単体を必須にする（BETTER_AUTH_URL へのフォールバックは無い —
  // 設計 §3.5 手順3。fulfillment-alerts.ts の adminOrderUrl とは意図的に不揃い）。
  const desiredUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/printful?secret=${process.env.PRINTFUL_WEBHOOK_SECRET}`
  const desiredTypes = PRINTFUL_WEBHOOK_EVENT_TYPES

  const lookup = await getPrintfulWebhooks()
  if (lookup.kind === "unauthorized") {
    // 読めない状態で書き込むのはより危険（設計 §3.7）。登録は試みない。
    return { kind: "unauthorized", httpStatus: lookup.httpStatus }
  }
  if (lookup.kind === "error") {
    return { kind: "skipped", reason: `could not check current registration: ${lookup.message}` }
  }

  const current = lookup.kind === "found" ? lookup.config : null
  const diagnostic = diagnose(current, desiredUrl, desiredTypes)

  const firstPass = decideWebhookSync(current, desiredUrl, desiredTypes, null)
  if (firstPass.action === "up_to_date") return { kind: "up_to_date", diagnostic }

  // ガードは「登録が必要と分かった後」にだけ実行する（設計 §3.4・§3.5 手順6）。
  const candidateWithoutSecret = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/printful`
  const urlIsReachable = await probeWebhookUrlIsReachable(candidateWithoutSecret)
  const finalDecision = decideWebhookSync(current, desiredUrl, desiredTypes, urlIsReachable)

  if (finalDecision.action === "skip") return { kind: "skipped", reason: finalDecision.reason }

  const registerResult = await replacePrintfulWebhooks(desiredUrl, desiredTypes)
  if (registerResult.kind === "registered") return { kind: "registered", diagnostic }
  if (registerResult.kind === "unauthorized") return { kind: "unauthorized", httpStatus: registerResult.httpStatus }
  return { kind: "register_failed", message: registerResult.message, diagnostic }
}
