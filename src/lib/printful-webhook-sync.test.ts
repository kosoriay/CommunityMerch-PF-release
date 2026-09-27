import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

const printfulClient = vi.hoisted(() => ({
  getPrintfulWebhooks: vi.fn(),
  replacePrintfulWebhooks: vi.fn(),
  probeWebhookUrlIsReachable: vi.fn(),
}))
vi.mock("@/lib/providers/printful", () => printfulClient)

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn().mockResolvedValue({ user: { platformRole: "platform_admin" } }) } } }))
vi.mock("next/headers", () => ({ headers: async () => new Headers() }))

import {
  decideWebhookSync,
  registerPrintfulWebhooksIfNeeded,
  isPrintfulWebhookAutoRegisterEnabled,
} from "./printful-webhook-sync"
import { registerPrintfulWebhooksAction } from "@/app/admin/_actions"
import type { PrintfulWebhookConfig } from "@/lib/providers/printful"
import { PRINTFUL_WEBHOOK_EVENT_TYPES } from "@/lib/printful-status"

const URL = "https://app.example.com/api/webhooks/printful?secret=x"
const TYPES = ["a", "b", "c"] as const
const current = (over: Partial<PrintfulWebhookConfig>): PrintfulWebhookConfig => ({ url: URL, types: [...TYPES], ...over })

describe("decideWebhookSync", () => {
  it("up_to_date: same url, same types (order-independent)", () => {
    expect(decideWebhookSync(current({ types: ["c", "a", "b"] }), URL, TYPES, null)).toEqual({ action: "up_to_date" })
  })

  it("register: not registered at all (current is null)", () => {
    expect(decideWebhookSync(null, URL, TYPES, true)).toEqual({ action: "register" })
  })

  it("register: url differs, guard passed", () => {
    expect(decideWebhookSync(current({ url: "https://old.example.com/api/webhooks/printful?secret=x" }), URL, TYPES, true))
      .toEqual({ action: "register" })
  })

  it("register: types differ (missing one), guard passed", () => {
    expect(decideWebhookSync(current({ types: ["a", "b"] }), URL, TYPES, true)).toEqual({ action: "register" })
  })

  it("skip: mismatch but the guard says the candidate URL is not reachable", () => {
    expect(decideWebhookSync(current({ types: ["a"] }), URL, TYPES, false))
      .toEqual({ action: "skip", reason: "candidate URL did not answer as this app's webhook route" })
  })

  it("does not run the guard when already up to date — urlIsReachable is ignored on a match", () => {
    // urlIsReachable: false でも、一致していれば up_to_date のまま
    // （設計 §3.4「ガードは登録が必要と分かった後にだけ実行する」— 呼び出し側の契約だが、
    // 判定関数自身もこの引数だけで矛盾しないことを保証する）
    expect(decideWebhookSync(current({}), URL, TYPES, false)).toEqual({ action: "up_to_date" })
  })
})

const REQUIRED_ENV = {
  PRINTFUL_API_KEY: "pf_test",
  PRINTFUL_WEBHOOK_SECRET: "shh",
  NEXT_PUBLIC_APP_URL: "https://app.example.com",
}
const DESIRED_URL = "https://app.example.com/api/webhooks/printful?secret=shh"

function withEnv(vars: Record<string, string | undefined>, fn: () => Promise<void>) {
  const saved: Record<string, string | undefined> = {}
  for (const k of Object.keys(vars)) {
    saved[k] = process.env[k]
    const v = vars[k]
    // `process.env[k] = undefined` coerces to the string "undefined" in Node,
    // which is truthy — that would silently defeat the "missing var" tests below.
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
  return fn().finally(() => {
    for (const k of Object.keys(vars)) {
      if (saved[k] === undefined) delete process.env[k]
      else process.env[k] = saved[k]
    }
  })
}

beforeEach(() => vi.clearAllMocks())
afterEach(() => { for (const k of Object.keys(REQUIRED_ENV)) delete process.env[k] })

describe("registerPrintfulWebhooksIfNeeded — env and kill switch", () => {
  it("skips, naming the missing variable, when NEXT_PUBLIC_APP_URL is not set", async () =>
    withEnv({ ...REQUIRED_ENV, NEXT_PUBLIC_APP_URL: undefined }, async () => {
      const result = await registerPrintfulWebhooksIfNeeded(new Date())
      expect(result).toEqual({ kind: "skipped", reason: "missing environment variable(s): NEXT_PUBLIC_APP_URL" })
      expect(printfulClient.getPrintfulWebhooks).not.toHaveBeenCalled()
    }))

  it("skips when PRINTFUL_WEBHOOK_AUTO_REGISTER=false (D7 — kill switch)", async () =>
    withEnv({ ...REQUIRED_ENV, PRINTFUL_WEBHOOK_AUTO_REGISTER: "false" }, async () => {
      const result = await registerPrintfulWebhooksIfNeeded(new Date())
      expect(result).toEqual({ kind: "skipped", reason: "disabled by PRINTFUL_WEBHOOK_AUTO_REGISTER=false" })
      expect(printfulClient.getPrintfulWebhooks).not.toHaveBeenCalled()
    }))

  it("is enabled by default — only the literal string \"false\" disables it", () => {
    delete process.env.PRINTFUL_WEBHOOK_AUTO_REGISTER
    expect(isPrintfulWebhookAutoRegisterEnabled()).toBe(true)
    process.env.PRINTFUL_WEBHOOK_AUTO_REGISTER = "FALSE"
    expect(isPrintfulWebhookAutoRegisterEnabled()).toBe(true) // 大文字は無効化しない — isPrintfulAutoConfirm と同じ書式
    process.env.PRINTFUL_WEBHOOK_AUTO_REGISTER = "false"
    expect(isPrintfulWebhookAutoRegisterEnabled()).toBe(false)
    delete process.env.PRINTFUL_WEBHOOK_AUTO_REGISTER
  })
})

describe("registerPrintfulWebhooksIfNeeded — decision and diagnostic", () => {
  it("up_to_date: does not call the probe or replace", async () =>
    withEnv(REQUIRED_ENV, async () => {
      printfulClient.getPrintfulWebhooks.mockResolvedValue({
        kind: "found", config: { url: DESIRED_URL, types: [...PRINTFUL_WEBHOOK_EVENT_TYPES] },
      })
      const result = await registerPrintfulWebhooksIfNeeded(new Date())
      expect(result).toEqual({ kind: "up_to_date", diagnostic: { urlMatches: true, matchedTypes: 9, totalTypes: 9 } })
      expect(printfulClient.probeWebhookUrlIsReachable).not.toHaveBeenCalled()
      expect(printfulClient.replacePrintfulWebhooks).not.toHaveBeenCalled()
    }))

  it("registered: mismatch, probe passes, replace succeeds", async () =>
    withEnv(REQUIRED_ENV, async () => {
      printfulClient.getPrintfulWebhooks.mockResolvedValue({ kind: "none" })
      printfulClient.probeWebhookUrlIsReachable.mockResolvedValue(true)
      printfulClient.replacePrintfulWebhooks.mockResolvedValue({ kind: "registered" })
      const result = await registerPrintfulWebhooksIfNeeded(new Date())
      expect(result.kind).toBe("registered")
      expect(printfulClient.replacePrintfulWebhooks).toHaveBeenCalledWith(DESIRED_URL, [...PRINTFUL_WEBHOOK_EVENT_TYPES])
    }))

  it("skipped: mismatch, probe fails — never calls replace (destructive P1 avoided)", async () =>
    withEnv(REQUIRED_ENV, async () => {
      printfulClient.getPrintfulWebhooks.mockResolvedValue({ kind: "none" })
      printfulClient.probeWebhookUrlIsReachable.mockResolvedValue(false)
      const result = await registerPrintfulWebhooksIfNeeded(new Date())
      expect(result).toMatchObject({ kind: "skipped" })
      expect(printfulClient.replacePrintfulWebhooks).not.toHaveBeenCalled()
    }))

  it("unauthorized: does not attempt to register (reading failed, so writing is riskier — 設計 §3.7)", async () =>
    withEnv(REQUIRED_ENV, async () => {
      printfulClient.getPrintfulWebhooks.mockResolvedValue({ kind: "unauthorized", httpStatus: 403 })
      const result = await registerPrintfulWebhooksIfNeeded(new Date())
      expect(result).toEqual({ kind: "unauthorized", httpStatus: 403 })
      expect(printfulClient.probeWebhookUrlIsReachable).not.toHaveBeenCalled()
      expect(printfulClient.replacePrintfulWebhooks).not.toHaveBeenCalled()
    }))

  it("register_failed: replace itself fails, with a diagnostic still attached", async () =>
    withEnv(REQUIRED_ENV, async () => {
      printfulClient.getPrintfulWebhooks.mockResolvedValue({
        kind: "found", config: { url: DESIRED_URL, types: ["order_updated"] },
      })
      printfulClient.probeWebhookUrlIsReachable.mockResolvedValue(true)
      printfulClient.replacePrintfulWebhooks.mockResolvedValue({ kind: "error", message: "HTTP 500" })
      const result = await registerPrintfulWebhooksIfNeeded(new Date())
      expect(result).toEqual({
        kind: "register_failed", message: "HTTP 500",
        diagnostic: { urlMatches: true, matchedTypes: 1, totalTypes: 9 },
      })
    }))

  it("diagnostic never carries the raw url or types (設計 §3.8 🔴 masking)", async () =>
    withEnv(REQUIRED_ENV, async () => {
      printfulClient.getPrintfulWebhooks.mockResolvedValue({
        kind: "found", config: { url: "https://leaked.example.com/?secret=SHOULD_NOT_APPEAR", types: ["x"] },
      })
      printfulClient.probeWebhookUrlIsReachable.mockResolvedValue(true)
      printfulClient.replacePrintfulWebhooks.mockResolvedValue({ kind: "registered" })
      const result = await registerPrintfulWebhooksIfNeeded(new Date())
      expect(JSON.stringify(result)).not.toContain("leaked.example.com")
      expect(JSON.stringify(result)).not.toContain("SHOULD_NOT_APPEAR")
    }))
})

describe("kill switch applies to both entry points (D7 — cross-path)", () => {
  it("the manual button also skips when PRINTFUL_WEBHOOK_AUTO_REGISTER=false", async () =>
    withEnv({ ...REQUIRED_ENV, PRINTFUL_WEBHOOK_AUTO_REGISTER: "false" }, async () => {
      const state = await registerPrintfulWebhooksAction(undefined)
      expect(state.result).toEqual({ kind: "skipped", reason: "disabled by PRINTFUL_WEBHOOK_AUTO_REGISTER=false" })
      expect(printfulClient.getPrintfulWebhooks).not.toHaveBeenCalled()
    }))
})
