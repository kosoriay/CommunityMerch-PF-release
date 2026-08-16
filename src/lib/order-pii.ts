import { db } from "@/lib/db/client"
import { orders } from "@/lib/db/schema"
import { eq, inArray, isNull } from "drizzle-orm"

/** 判定に必要な最小の形。行全体を要求しない。 */
export type AnonymizableOrder = {
  id: string
  status: "pending" | "paid" | "fulfilled" | "shipped" | "delivered" | "refunded"
  updatedAt: Date
  piiAnonymizedAt: Date | null
}

/**
 * 買い手の情報を消してよい状態。
 *
 * `paid` と `fulfilled` は発送前である。住所を消せばその注文は二度と届けられない。
 * `pending` は決済が完了していない。いずれも、どれだけ古くても対象にしない。
 *
 * `refunded` を含めるのは、返金済みが終端状態だからである。金銭は精算されており、
 * そのあと何年も自宅住所を保持する理由がない。除外すると「返金した注文だけ PII が
 * 永久に残る」という穴になる。
 */
const TERMINAL_STATUSES = new Set(["shipped", "delivered", "refunded"])

/** 手動実行が、この日数より新しい注文を拒む。返金には買い手の身元が要る。 */
export const DISPUTE_WINDOW_DAYS = 90

/** 保持期間の既定値。`ORDER_PII_RETENTION_MONTHS` で上書きできる。 */
export const DEFAULT_RETENTION_MONTHS = 24

/** 1回の実行で匿名化する上限。 */
export const ANONYMIZE_LIMIT = 500

const DAY_MS = 86_400_000
const MONTH_MS = 30 * DAY_MS

/**
 * 保持期間を過ぎた注文を選ぶ。DB に触らないので単体で試験できる。
 *
 * 匿名化は元に戻せない。したがってこの関数の重要な性質は「選ぶこと」ではなく、
 * 発送前の注文と、既に匿名化済みの注文を**選ばない**ことである。
 */
export function selectAnonymizableOrders(args: {
  orders: AnonymizableOrder[]
  now: Date
  retentionMonths: number
  limit: number
}): string[] {
  const { orders: rows, now, retentionMonths, limit } = args
  const cutoff = now.getTime() - retentionMonths * MONTH_MS
  const selected: string[] = []

  for (const row of rows) {
    if (selected.length >= limit) break
    if (!TERMINAL_STATUSES.has(row.status)) continue
    if (row.piiAnonymizedAt !== null) continue
    if (row.updatedAt.getTime() > cutoff) continue
    selected.push(row.id)
  }

  return selected
}

export type AnonymizeCheck = { ok: true } | { ok: false; error: string }

/**
 * 管理画面からの手動匿名化を許すか。
 *
 * `force` で越えられるのは係争期間だけである。発送前であることと、既に匿名化済みで
 * あることは、強制しても越えられない — 前者は商品が届かなくなり、後者は意味がない。
 */
export function canAnonymizeNow(
  order: AnonymizableOrder,
  now: Date,
  options: { force: boolean }
): AnonymizeCheck {
  if (order.piiAnonymizedAt !== null) {
    return { ok: false, error: "This order has already been anonymized." }
  }
  if (!TERMINAL_STATUSES.has(order.status)) {
    return {
      ok: false,
      error: "This order has not shipped yet. Clearing the address would make it undeliverable.",
    }
  }
  if (options.force) return { ok: true }

  const age = now.getTime() - order.updatedAt.getTime()
  if (age < DISPUTE_WINDOW_DAYS * DAY_MS) {
    return {
      ok: false,
      error: `Refunds need the buyer's details, and this order changed less than ${DISPUTE_WINDOW_DAYS} days ago.`,
    }
  }
  return { ok: true }
}

/** 環境変数から保持期間を読む。壊れた値は既定に落とす。 */
export function resolveRetentionMonths(): number {
  const raw = process.env.ORDER_PII_RETENTION_MONTHS
  if (!raw) return DEFAULT_RETENTION_MONTHS
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_RETENTION_MONTHS
  return parsed
}

/**
 * 買い手を特定する列を NULL にし、実行時刻を刻む。
 *
 * 金額・キャンペーン・Stripe の識別子は残す。売上の集計と Stripe との突き合わせは
 * 後からも成立しなければならない。
 */
export async function anonymizeOrders(orderIds: string[], now: Date): Promise<number> {
  if (orderIds.length === 0) return 0

  await db
    .update(orders)
    .set({
      buyerName: null,
      buyerEmail: null,
      shippingAddressJson: null,
      trackingNumber: null,
      trackingUrl: null,
      carrier: null,
      piiAnonymizedAt: now,
      updatedAt: now,
    })
    .where(inArray(orders.id, orderIds))

  return orderIds.length
}

export type AnonymizeSweepResult = { scanned: number; anonymized: number }

/**
 * 保持期間を過ぎた注文の買い手情報を消す。cron から呼ばれる。
 *
 * 候補は「まだ匿名化されていない注文」だけを読む。全件を読み直しても結果は同じだが、
 * 年数が経つほど無駄が増える。
 */
export async function sweepExpiredOrderPII(now: Date): Promise<AnonymizeSweepResult> {
  const rows = await db
    .select({
      id: orders.id,
      status: orders.status,
      updatedAt: orders.updatedAt,
      piiAnonymizedAt: orders.piiAnonymizedAt,
    })
    .from(orders)
    .where(isNull(orders.piiAnonymizedAt))

  const ids = selectAnonymizableOrders({
    orders: rows,
    now,
    retentionMonths: resolveRetentionMonths(),
    limit: ANONYMIZE_LIMIT,
  })

  const anonymized = await anonymizeOrders(ids, now)
  return { scanned: rows.length, anonymized }
}

/** 管理画面の1件操作。呼び出し側が権限を確認済みであること。 */
export async function anonymizeSingleOrder(
  orderId: string,
  now: Date,
  options: { force: boolean }
): Promise<AnonymizeCheck> {
  const row = await db.query.orders.findFirst({ where: eq(orders.id, orderId) })
  if (!row) return { ok: false, error: "Order not found." }

  const allowed = canAnonymizeNow(row, now, options)
  if (!allowed.ok) return allowed

  await anonymizeOrders([orderId], now)
  return { ok: true }
}
