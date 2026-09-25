import { db } from "@/lib/db/client"
import { orders, orderItems, campaigns, organizations } from "@/lib/db/schema"
import { eq, and, or, isNull, isNotNull, inArray, notInArray, lte, ne, desc, asc, sql, type SQL } from "drizzle-orm"
import {
  PRINTFUL_HEALTHY_STATUSES,
  PRINTFUL_POLLING_DONE_STATUSES,
  PRINTFUL_NOT_FOUND,
  PRINTFUL_STATUS_STALE_HOURS,
  UNSUBMITTED_ORDER_ALERT_MINUTES,
  truncatePrintfulText,
} from "@/lib/printful-status"

export type CartItem = {
  campaignProductId: string
  size: string
  quantity: number
  unitPriceCents: number
  /**
   * 必須。`/api/checkout` が検証済みの値だけがここへ来る。
   *
   * 以前は optional で `?? "White"` が既定を書いていた。その既定は17商品中
   * 7商品で誤りであり、うち2商品では Printful に variant が無く決済成功後の
   * 発注が throw していた（設計 §3.2）。**省略を許すと検証を素通りできる。**
   */
  color: string
}

export async function createPendingOrder(
  campaignId: string,
  cartItems: CartItem[]
): Promise<typeof orders.$inferSelect> {
  const id = crypto.randomUUID()
  const now = new Date()
  const totalAmountCents = cartItems.reduce(
    (sum, item) => sum + item.unitPriceCents * item.quantity,
    0
  )

  await db.transaction(async (tx) => {
    await tx.insert(orders).values({
      id,
      campaignId,
      totalAmountCents,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    })
    for (const item of cartItems) {
      await tx.insert(orderItems).values({
        id: crypto.randomUUID(),
        orderId: id,
        campaignProductId: item.campaignProductId,
        size: item.size,
        color: item.color,
        quantity: item.quantity,
        unitPrice: item.unitPriceCents,
      })
    }
  })

  return (await db.query.orders.findFirst({ where: eq(orders.id, id) }))!
}

export async function getOrder(orderId: string) {
  return db.query.orders.findFirst({
    where: eq(orders.id, orderId),
    with: {
      items: {
        with: { product: true },
      },
      campaign: {
        with: { org: true, design: true },
      },
    },
  })
}

export async function markOrderPaid(
  orderId: string,
  data: {
    stripePaymentIntentId: string
    stripeCheckoutSessionId: string
    buyerEmail: string
    /**
     * Stripe は氏名を返さないことがある。列は nullable（`schema.ts:190`）で、
     * 読み手はすべて null を扱える（`admin/orders/page.tsx:81` の `?? "—"`、
     * `orgs-orders.ts:11` の `string | null`、`order-pii.ts:119` は実際に
     * null を書く）。この引数だけが `string` で、スキーマと食い違っていた。
     *
     * **名前が無いことを "Customer" で埋めないこと。** 埋めると管理画面は
     * それを買い手の氏名として表示し、`admin.ts:96` の氏名検索が名無しの
     * 注文を全件拾う。表示の既定値は表示側が決める。
     */
    buyerName: string | null
    shippingAddressJson: string
  },
  now: Date
): Promise<boolean> {
  // pending からだけ。Stripe は同じイベントを再送する（イベントIDでの重複排除は
  // 無い）。条件が無いと、発送済み・返金済みの注文が paid に戻り、再び発注処理に
  // 入っていた（設計 2026-09-21 §7・C8）。
  const moved = await db
    .update(orders)
    .set({
      status: "paid",
      // 区分 B（発注されていない）の時計。updated_at で代用しない（設計 §3）
      paidAt: now,
      stripePaymentIntentId: data.stripePaymentIntentId,
      stripeCheckoutSessionId: data.stripeCheckoutSessionId,
      buyerEmail: data.buyerEmail,
      buyerName: data.buyerName,
      shippingAddressJson: data.shippingAddressJson,
      updatedAt: now,
    })
    .where(and(eq(orders.id, orderId), eq(orders.status, "pending")))
    .returning({ id: orders.id })
  return moved.length > 0
}

/**
 * paid → fulfilled。**paid のときだけ**遷移し、遷移したかを返す（設計 §7）。
 * 確認メールは true を受け取った側だけが送る。
 */
export async function markOrderFulfilled(
  orderId: string,
  printfulOrderId: number,
  now: Date
): Promise<boolean> {
  const moved = await db
    .update(orders)
    .set({
      status: "fulfilled",
      printfulOrderId: String(printfulOrderId),
      // Clear the failure: without this a successful retry leaves the order
      // on the needs-attention list forever.
      fulfillmentError: null,
      updatedAt: now,
    })
    .where(and(eq(orders.id, orderId), eq(orders.status, "paid")))
    .returning({ id: orders.id })
  return moved.length > 0
}

/**
 * 遷移しなかった注文（発注の最中に返金された等）にも、Printful 上に注文が実在する
 * 事実は残す（設計 §5.3 手順3）。まだ空のときだけ書く。status には触らない。
 */
export async function recordPrintfulOrderIdIfMissing(
  orderId: string,
  printfulOrderId: number
): Promise<void> {
  await db
    .update(orders)
    .set({ printfulOrderId: String(printfulOrderId) })
    .where(and(eq(orders.id, orderId), isNull(orders.printfulOrderId)))
}

/**
 * paid / fulfilled → shipped。遷移したかを返す（設計 §7）。paid から直接来るのは、
 * Printful は受け付けたがこちらの記録が失敗した場合。発送メールは true の側だけが送る。
 */
export async function markOrderShipped(
  orderId: string,
  data: {
    trackingNumber: string
    carrier: string
    trackingUrl: string
  }
): Promise<boolean> {
  const moved = await db
    .update(orders)
    .set({
      status: "shipped",
      trackingNumber: data.trackingNumber,
      carrier: data.carrier,
      trackingUrl: data.trackingUrl,
      updatedAt: new Date(),
    })
    .where(and(eq(orders.id, orderId), inArray(orders.status, ["paid", "fulfilled"])))
    .returning({ id: orders.id })
  return moved.length > 0
}

/**
 * 発注の失敗を記録する。paid の注文だけ。回数は SQL 側で +1 する — 読んでから
 * 書くと、並行2回で +1 にしかならない（設計 §7・C10）。
 */
export async function markFulfillmentFailed(
  orderId: string,
  errorMessage: string
): Promise<void> {
  await db
    .update(orders)
    .set({
      fulfillmentAttempts: sql`${orders.fulfillmentAttempts} + 1`,
      fulfillmentError: errorMessage,
      updatedAt: new Date(),
    })
    .where(and(eq(orders.id, orderId), eq(orders.status, "paid")))
}

// ── Printful 側の状態（設計 §5）────────────────────────────────────────────
//
// 以下の関数は **updated_at を更新しない**（§3。PII の保持期間の起点）。
// 時刻の比較は drizzle の列演算子で書く。raw `sql` に Date を渡すと ISO 文字列で
// 束縛され、秒で保存された列との比較が壊れる（§10.2 🧪）。

export type PrintfulObservation = { status: string; updated: number | null }

/** `recordPrintfulObservation` が実際に何をしたか。呼び出し側は主に `changed` を見るが、
 * `outcome` は「弾かれた観測が同じ状態だったか、別の状態だったか」を区別する。 */
export type PrintfulObservationOutcome = "written" | "unchanged" | "stale"
export type PrintfulObservationResult = { changed: boolean; outcome: PrintfulObservationOutcome }

/**
 * Printful の状態の観測を書く、唯一の口（設計 §5.1）。
 *
 * - 古い観測（Printful の `updated` が記録より古い）で状態を上書きしない。
 *   ただし not_found（404）にはこの条件を使わない（「いま存在しない」は照会時点の事実）
 * - 状態が変わったら理由も入れ替える（reason = null なら null）。変わらなければ
 *   理由は非 null のときだけ上書きする — cron は理由を持たないので、webhook が
 *   入れた理由を消してはいけない
 * - 確認に成功したので、確認の失敗の記録（§5.6）は必ず消す
 *
 * 🔴 訂正（最終レビュー・2026-09-22）：上の「確認に成功したので消す」は、古さで弾かれた
 * 観測が**記録済みと同じ状態**のときにしか成り立たない。弾かれた観測が**別の状態**を
 * 運んでいた場合（例：記録は `(pending, updated=1000)`、届いたのは
 * `(failed, updated=null)`）、それは「確認できた」のではなく「Printful がいまの状態と
 * 矛盾する応答を寄越したが、古さの都合で採用できなかった」であり、`checked_at` を
 * 進めて確認失敗の記録を消すと、その注文は C1 にも C2 にも出なくなる — 買い手は
 * "preparing" を見続ける。この場合は `source` で確認失敗を記録し（§5.6 と同じ経路）、
 * `checked_at` は進めない。`source` は呼び出し側の識別子をそのまま渡す
 * （webhook のイベント種別・`"reconcile"`・`"submit"`）。
 */
export async function recordPrintfulObservation(
  orderId: string,
  obs: PrintfulObservation,
  reason: string | null,
  source: string,
  now: Date
): Promise<PrintfulObservationResult> {
  if (typeof obs.status !== "string" || obs.status.trim() === "") {
    // null で上書きすると警報が消える。呼び出し側は確認の失敗として扱うこと
    throw new Error("recordPrintfulObservation: observation has no status")
  }
  const status = obs.status
  const cleanReason = reason === null ? null : truncatePrintfulText(reason)
  const isNotFound = status === PRINTFUL_NOT_FOUND

  const fresh: SQL | undefined = isNotFound
    ? undefined
    : obs.updated === null
      ? isNull(orders.printfulUpdatedAt)
      : or(isNull(orders.printfulUpdatedAt), lte(orders.printfulUpdatedAt, obs.updated))

  const changedRows = await db
    .update(orders)
    .set({
      printfulStatus: status,
      printfulStatusReason: cleanReason,
      ...(isNotFound ? {} : { printfulUpdatedAt: obs.updated }),
      printfulStatusCheckedAt: now,
      printfulCheckFailedAt: null,
      printfulCheckError: null,
    })
    .where(
      and(
        eq(orders.id, orderId),
        or(isNull(orders.printfulStatus), ne(orders.printfulStatus, status)),
        fresh
      )
    )
    .returning({ id: orders.id })
  if (changedRows.length > 0) return { changed: true, outcome: "written" }

  // 書けなかった：状態が既に同じか、別の状態が古さで弾かれたかのどちらか。読んで区別する。
  // not_found は常にここに来ない（fresh を適用しないので、状態が違えば必ず書ける）。
  const [current] = await db
    .select({ printfulStatus: orders.printfulStatus, printfulUpdatedAt: orders.printfulUpdatedAt })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1)
  const isStaleDifferentStatus = !isNotFound && current !== undefined && current.printfulStatus !== status

  if (isStaleDifferentStatus) {
    await recordPrintfulCheckFailure(
      orderId,
      source,
      `stale observation rejected: incoming "${status}" (updated=${obs.updated ?? "null"}) is not newer than the recorded "${current!.printfulStatus}" (updated=${current!.printfulUpdatedAt ?? "null"})`,
      now
    )
    return { changed: false, outcome: "stale" }
  }

  // 状態は同じ。確認できた事実だけを書く。
  await db
    .update(orders)
    .set({
      printfulStatusCheckedAt: now,
      printfulCheckFailedAt: null,
      printfulCheckError: null,
    })
    .where(eq(orders.id, orderId))

  // 状態が変わらないときも printful_updated_at は進める（同じ guard 付きで）。
  // 訂正（設計 §5.1 🔴・2026-09-21）：これが無いと `(inprocess, 100)` の後に届いた
  // `(inprocess, 300)` が基準を進めず、後から届いた古い別状態 `(onhold, 200)` が
  // `100 <= 200` を満たして通ってしまう（解消済みの異常で通知が飛びうる）。
  // not_found は対象外（printful_updated_at を変えない、というルールそのまま）。
  if (!isNotFound && obs.updated !== null) {
    await db
      .update(orders)
      .set({ printfulUpdatedAt: obs.updated })
      .where(
        and(
          eq(orders.id, orderId),
          eq(orders.printfulStatus, status),
          or(isNull(orders.printfulUpdatedAt), lte(orders.printfulUpdatedAt, obs.updated))
        )
      )
  }

  if (cleanReason !== null) {
    // 条件は「記録済みの状態といまも同じ状態への観測」であること — 別の状態に
    // 古い理由を残さないための保護。**理由そのものの新しさは保証しない**
    // （設計 §5.1 🔴）：同じ状態への観測なら、古い観測の理由でも上書きする。
    await db
      .update(orders)
      .set({ printfulStatusReason: cleanReason })
      .where(and(eq(orders.id, orderId), eq(orders.printfulStatus, status)))
  }
  return { changed: false, outcome: "unchanged" }
}

/**
 * Printful への確認に失敗したことを記録する（設計 §5.6）。printful_status には触らない
 * （分からないことを、分かったことにしない）。区分 C2 (a) にすぐ出る。
 */
export async function recordPrintfulCheckFailure(
  orderId: string,
  source: string,
  error: string,
  now: Date
): Promise<void> {
  await db
    .update(orders)
    .set({
      printfulCheckFailedAt: now,
      printfulCheckError: truncatePrintfulText(`${source}: ${error}`),
    })
    .where(eq(orders.id, orderId))
}

/** shouldAlertPrintfulStatus（printful-status.ts）と同じ判定の SQL 版。表で突き合わせて試す。 */
function alertablePrintfulStatus(autoConfirm: boolean): SQL {
  return and(
    isNotNull(orders.printfulStatus),
    notInArray(orders.printfulStatus, [...PRINTFUL_HEALTHY_STATUSES]),
    autoConfirm ? undefined : ne(orders.printfulStatus, "draft")
  )!
}

export type PrintfulAlertClaim = {
  orderId: string
  printfulStatus: string
  printfulStatusReason: string | null
  printfulOrderId: string | null
  campaignTitle: string
  orgName: string
}

/**
 * 通知の権利を取る（設計 §5.2）。**書き込みとは別に、いまの状態で決める。**
 *
 * 1本の条件付き UPDATE が通った呼び出しだけが通知する。同じ変化を2つの経路が
 * 同時に書いても通知は1回。通知対象でなくなったら印を消す（直った後の再発を
 * もう一度知らせるため）。
 */
export async function claimPrintfulAlert(
  orderId: string,
  autoConfirm: boolean
): Promise<PrintfulAlertClaim | null> {
  const [claimed] = await db
    .update(orders)
    .set({ printfulAlertedStatus: sql`${orders.printfulStatus}` })
    .where(
      and(
        eq(orders.id, orderId),
        eq(orders.status, "fulfilled"),
        alertablePrintfulStatus(autoConfirm),
        or(isNull(orders.printfulAlertedStatus), ne(orders.printfulAlertedStatus, orders.printfulStatus))
      )
    )
    .returning({
      campaignId: orders.campaignId,
      printfulStatus: orders.printfulStatus,
      printfulStatusReason: orders.printfulStatusReason,
      printfulOrderId: orders.printfulOrderId,
    })

  if (!claimed) {
    await db
      .update(orders)
      .set({ printfulAlertedStatus: null })
      .where(
        and(
          eq(orders.id, orderId),
          isNotNull(orders.printfulAlertedStatus),
          or(
            isNull(orders.printfulStatus),
            inArray(orders.printfulStatus, [...PRINTFUL_HEALTHY_STATUSES]),
            autoConfirm ? undefined : eq(orders.printfulStatus, "draft")
          )
        )
      )
    return null
  }

  const [context] = await db
    .select({ campaignTitle: campaigns.title, orgName: organizations.name })
    .from(campaigns)
    .innerJoin(organizations, eq(organizations.id, campaigns.orgId))
    .where(eq(campaigns.id, claimed.campaignId))

  return {
    orderId,
    printfulStatus: claimed.printfulStatus!,
    printfulStatusReason: claimed.printfulStatusReason,
    printfulOrderId: claimed.printfulOrderId,
    campaignTitle: context?.campaignTitle ?? "unknown campaign",
    orgName: context?.orgName ?? "unknown organization",
  }
}

/**
 * 通知を送れなかったときに権利を返す（最終レビュー指摘）。
 *
 * `claimPrintfulAlert` は書き込み（メール送信）の前に権利を取る。まとめ送信
 * （cron のダイジェスト）でメール自体が失敗すると、権利は取られたままなのに
 * 誰にも届いておらず、次回以降その注文は二度と通知されない。渡された注文の
 * `printful_alerted_status = NULL` に戻し、次回の `claimPrintfulAlert` が
 * もう一度通るようにする。
 *
 * 🔴 訂正（再レビュー・最終レビューの直後）：ID だけで戻すと、この回のダイジェストを
 * 送っている間に**別の経路（webhook）が同じ注文で正当な再取得をした場合**、その
 * webhook の取得ごと消してしまう。例：reconcile が `failed` の権利を取り、ダイジェスト
 * を送っている最中に webhook が `onhold`（別の変化）を観測して正当に再取得・送信し、
 * その後 reconcile のダイジェストが失敗する → ID だけで戻すと `onhold` の権利まで
 * NULL に戻り、次回また `onhold` を二重通知してしまう（§5.2「1回の変化につき1回」に反する）。
 * **戻すのは「いまも、この回が取った状態のままの行」だけ** — `printful_alerted_status`
 * がその時点で `claim.printfulStatus` と一致する場合に限って NULL に戻す条件付き UPDATE。
 * 一致しなければ、別経路が既に先に進めているということなので触らない。
 */
export async function releasePrintfulAlertClaims(claims: { orderId: string; printfulStatus: string }[]): Promise<void> {
  for (const claim of claims) {
    await db
      .update(orders)
      .set({ printfulAlertedStatus: null })
      .where(and(eq(orders.id, claim.orderId), eq(orders.printfulAlertedStatus, claim.printfulStatus)))
  }
}

// ── 要対応（設計 §6.1）──────────────────────────────────────────────────────
//
// 区分の条件は**ここにしか書かない。**一覧（ダッシュボード）と1件の判定（注文詳細）が
// 同じ関数を使う。Printful の値の集合は printful-status.ts の定数だけを使う。
// NOT IN / <> は NULL の行を落とすので、NULL は必ず IS NULL / IS NOT NULL で扱う。

export type AttentionCategory = "failed" | "unsubmitted" | "printful_stuck" | "printful_unchecked"

function minutesBefore(now: Date, minutes: number): Date {
  return new Date(now.getTime() - minutes * 60_000)
}

/** 区分ごとの WHERE。**関数の中で組み立てる**（schema をスタブするテストが import 時に落ちないように）。 */
export function attentionConditions(now: Date): Record<AttentionCategory, SQL> {
  const stuck = and(
    eq(orders.status, "fulfilled"),
    isNotNull(orders.printfulStatus),
    notInArray(orders.printfulStatus, [...PRINTFUL_HEALTHY_STATUSES])
  )!
  return {
    // A. 発注できなかった（既存）
    failed: and(eq(orders.status, "paid"), isNotNull(orders.fulfillmentError))!,
    // B. 発注されていない。境界は「以上」（ちょうど30分で出る）
    unsubmitted: and(
      eq(orders.status, "paid"),
      isNull(orders.fulfillmentError),
      or(isNull(orders.paidAt), lte(orders.paidAt, minutesBefore(now, UNSUBMITTED_ORDER_ALERT_MINUTES)))
    )!,
    // C1. Printful で止まっている
    printful_stuck: stuck,
    // C2. Printful の状態を確認できていない。C1 に当たる行は除く（C1 にだけ出す）
    printful_unchecked: and(
      eq(orders.status, "fulfilled"),
      or(isNull(orders.printfulStatus), inArray(orders.printfulStatus, [...PRINTFUL_HEALTHY_STATUSES])),
      or(
        // (a) 確認に失敗した — すぐに出る
        isNotNull(orders.printfulCheckFailedAt),
        // (b) 確認の機会そのものが無い — cron が1回まるごと届かなかった
        and(
          or(
            isNull(orders.printfulStatus),
            notInArray(orders.printfulStatus, [...PRINTFUL_POLLING_DONE_STATUSES])
          ),
          or(
            isNull(orders.printfulStatusCheckedAt),
            lte(orders.printfulStatusCheckedAt, minutesBefore(now, PRINTFUL_STATUS_STALE_HOURS * 60))
          )
        )
      )
    )!,
  }
}

const ATTENTION_ORDER: AttentionCategory[] = ["failed", "unsubmitted", "printful_stuck", "printful_unchecked"]

async function findAttentionOrders(where: SQL) {
  return db.query.orders.findMany({
    where,
    orderBy: [desc(orders.createdAt)],
    with: { campaign: { with: { org: true } } },
  })
}

export type AttentionOrder = Awaited<ReturnType<typeof findAttentionOrders>>[number]
export type NeedsAttentionOrders = Record<AttentionCategory, AttentionOrder[]>

/**
 * 管理ダッシュボード最上段の要対応（設計 §6.1）。
 *
 * A は、買い手が払ったのに印刷に届かなかった注文 — 何もしなければ何も発送されない。
 * B〜C2 は、この設計で見えるようになった同じ種類の沈黙である。
 */
export async function getNeedsAttentionOrders(now: Date): Promise<NeedsAttentionOrders> {
  const where = attentionConditions(now)
  const lists = await Promise.all(ATTENTION_ORDER.map((category) => findAttentionOrders(where[category])))
  return Object.fromEntries(ATTENTION_ORDER.map((category, i) => [category, lists[i]])) as NeedsAttentionOrders
}

/** 1件の注文がどの区分に当たるか（注文詳細のパネル用）。条件は getNeedsAttentionOrders と同じもの。 */
export async function getOrderAttentionCategory(orderId: string, now: Date): Promise<AttentionCategory | null> {
  const where = attentionConditions(now)
  for (const category of ATTENTION_ORDER) {
    const [hit] = await db
      .select({ id: orders.id })
      .from(orders)
      .where(and(eq(orders.id, orderId), where[category]))
      .limit(1)
    if (hit) return category
  }
  return null
}

/**
 * 定期照会の対象（設計 §5.5）。最後に試した時刻（確認できた時刻と失敗した時刻の
 * 新しい方）の古い順。どちらも NULL の行が先。恒久的に失敗する注文が先頭に居座らない。
 */
export function reconcileTargetCondition(): SQL {
  return and(
    eq(orders.status, "fulfilled"),
    or(
      isNull(orders.printfulStatus),
      notInArray(orders.printfulStatus, [...PRINTFUL_POLLING_DONE_STATUSES]),
      isNotNull(orders.printfulCheckFailedAt)
    )
  )!
}

export async function getReconcileTargets(limit: number): Promise<{ id: string }[]> {
  return db
    .select({ id: orders.id })
    .from(orders)
    .where(reconcileTargetCondition())
    .orderBy(
      // 列だけの式。Date を渡していない（上の注意を参照）
      sql`max(coalesce(${orders.printfulStatusCheckedAt}, 0), coalesce(${orders.printfulCheckFailedAt}, 0))`,
      asc(orders.createdAt)
    )
    .limit(limit)
}

export async function countReconcileTargets(): Promise<number> {
  return db.$count(orders, reconcileTargetCondition())
}

/** Correct a bad recipient address before retrying — the most common fixable cause. */
export async function updateShippingAddress(
  orderId: string,
  address: {
    line1: string
    line2?: string
    city: string
    state: string
    postal_code: string
    country?: string
  },
  buyerName?: string
): Promise<void> {
  await db
    .update(orders)
    .set({
      shippingAddressJson: JSON.stringify({ ...address, country: address.country ?? "US" }),
      ...(buyerName ? { buyerName } : {}),
      updatedAt: new Date(),
    })
    .where(eq(orders.id, orderId))
}
