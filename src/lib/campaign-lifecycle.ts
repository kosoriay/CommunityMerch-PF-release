import { db } from "@/lib/db/client"
import { campaigns } from "@/lib/db/schema"
import { and, eq, isNotNull, lte } from "drizzle-orm"

/** ライフサイクルの判断に必要な最小の形。行全体を要求しない。 */
export type LifecycleCampaign = {
  status: "draft" | "active" | "closed"
  deadline: Date | null
}

export type EffectiveStatus = "draft" | "active" | "closed"

/**
 * 保存されている `status` ではなく、いま実際にどの状態かを返す。
 *
 * 期限切れの判定を cron の書き込みに依存させないための関数である。cron が
 * 遅れても落ちても、期限を過ぎたキャンペーンはこの時点で closed と見なされる。
 */
export function effectiveStatus(campaign: LifecycleCampaign, now: Date): EffectiveStatus {
  if (campaign.status === "draft") return "draft"
  if (campaign.status === "closed") return "closed"
  // 境界は「期限ちょうどで終了」。買い手に見せるカウントダウン（daysUntil）と
  // 一致させてある。ずらすと UI とサーバーが食い違う。
  if (campaign.deadline !== null && campaign.deadline.getTime() <= now.getTime()) return "closed"
  return "active"
}

/**
 * 注文を受け付けてよいか。checkout はこれだけを見る。
 *
 * 目標金額は渡らない。目標は上限ではないので、達成しても売り続けられる。
 */
export function isSellingOpen(campaign: LifecycleCampaign, now: Date): boolean {
  return effectiveStatus(campaign, now) === "active"
}

export type LifecycleResult = { ok: true } | { ok: false; error: string }

/**
 * 再開してよいかを判定する。DB に触らないので単体で試験できる。
 *
 * 期限が過去のままの再開を断るのは、開いた瞬間に `effectiveStatus` がまた
 * closed を返し、団体から見て「ボタンが効かない」状態になるためである。
 */
export function canReopen(args: {
  orgClosed: boolean
  orgSuspended: boolean
  deadline: Date | null
  now: Date
}): LifecycleResult {
  if (args.orgClosed) return { ok: false, error: "This organization is closed." }
  if (args.orgSuspended) return { ok: false, error: "This organization is suspended." }
  if (args.deadline !== null && args.deadline.getTime() <= args.now.getTime()) {
    return {
      ok: false,
      error: "Set a deadline in the future, or clear it, before reopening.",
    }
  }
  return { ok: true }
}

/**
 * キャンペーンの販売を止める。
 *
 * 「中止」と「終了」を分けていない。支払い済みの注文はすでに印刷・発送に
 * 入っており巻き戻せないので、どちらでも起きることは同じである。
 */
export async function closeCampaign(campaignId: string): Promise<LifecycleResult> {
  const campaign = await db.query.campaigns.findFirst({
    where: eq(campaigns.id, campaignId),
  })
  if (!campaign) return { ok: false, error: "Campaign not found." }
  if (campaign.status === "draft") {
    return { ok: false, error: "This campaign has not been published yet." }
  }
  if (campaign.status === "closed") {
    return { ok: false, error: "This campaign is already closed." }
  }

  const now = new Date()
  await db
    .update(campaigns)
    .set({ status: "closed", closedAt: now, updatedAt: now })
    .where(eq(campaigns.id, campaignId))
  return { ok: true }
}

/**
 * 終了したキャンペーンを再び販売可能にする。呼び出し側が `canReopen` で団体の
 * 状態を確認済みであること。
 */
export async function reopenCampaign(
  campaignId: string,
  deadline: Date | null
): Promise<LifecycleResult> {
  const campaign = await db.query.campaigns.findFirst({
    where: eq(campaigns.id, campaignId),
  })
  if (!campaign) return { ok: false, error: "Campaign not found." }
  if (campaign.status !== "closed") {
    return { ok: false, error: "This campaign is not closed." }
  }

  const now = new Date()
  await db
    .update(campaigns)
    .set({ status: "active", closedAt: null, deadline, updatedAt: now })
    .where(eq(campaigns.id, campaignId))
  return { ok: true }
}

/**
 * 期限を過ぎた active を closed に書き戻す。cron から呼ばれる。
 *
 * これは後追いの記録であって、販売を止めているのは `isSellingOpen` である。
 * 遅れても金銭的な害はない。冪等。
 */
export async function materializeExpiredCampaigns(now: Date): Promise<number> {
  const expired = await db
    .select({ id: campaigns.id })
    .from(campaigns)
    .where(
      and(
        eq(campaigns.status, "active"),
        isNotNull(campaigns.deadline),
        lte(campaigns.deadline, now)
      )
    )

  for (const row of expired) {
    await db
      .update(campaigns)
      .set({ status: "closed", closedAt: now, updatedAt: now })
      .where(eq(campaigns.id, row.id))
  }
  return expired.length
}
