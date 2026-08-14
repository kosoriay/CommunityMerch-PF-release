import { formatCents } from "@/lib/format"
import { barWidthPercent, type ProgressVisibility } from "@/lib/campaign-progress"

type Props = {
  netRaisedCents: number
  goalCents: number | null
  percentOfGoal: number | null
  itemsSold: number
  supporterCount: number
  daysRemaining: number | null
  visibility: ProgressVisibility
  /** Distinguishes "nothing sold yet" from "not open for orders". */
  notLaunched?: boolean
}

/**
 * Campaign progress, shared by the public page, the organization dashboard and
 * the student view. Which figures appear is decided entirely by `visibility`
 * (`progressVisibility`), so no caller can accidentally leak money data to a
 * student or a buyer.
 */
export function CampaignProgressPanel({
  netRaisedCents,
  goalCents,
  percentOfGoal,
  itemsSold,
  supporterCount,
  daysRemaining,
  visibility,
  notLaunched = false,
}: Props) {
  const showMoney = visibility.showAmounts
  const facts = [
    `${itemsSold} ${itemsSold === 1 ? "item" : "items"} sold`,
    `${supporterCount} ${supporterCount === 1 ? "supporter" : "supporters"}`,
    daysRemaining !== null
      ? daysRemaining === 0
        ? "Campaign ended"
        : `${daysRemaining} ${daysRemaining === 1 ? "day" : "days"} left`
      : null,
  ].filter(Boolean) as string[]

  if (notLaunched) {
    return (
      <div className="rounded-lg border bg-white p-4">
        <p className="text-sm text-muted-foreground">Not launched yet — no orders can be placed.</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border bg-white p-4 space-y-2">
      {goalCents !== null && percentOfGoal !== null && (
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-muted-foreground">
              {showMoney ? (
                <>
                  <span className="font-medium text-foreground">
                    {formatCents(netRaisedCents)}
                  </span>{" "}
                  raised of {formatCents(goalCents)} goal
                </>
              ) : (
                "Fundraising goal"
              )}
            </span>
            <span className="font-medium">{percentOfGoal}%</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#378ADD] rounded-full transition-all"
              style={{ width: `${barWidthPercent(percentOfGoal)}%` }}
            />
          </div>
        </div>
      )}

      {/* With no goal there is no percentage to show, but sales still are. */}
      {goalCents === null && showMoney && (
        <p className="text-sm">
          <span className="font-medium">{formatCents(netRaisedCents)}</span>{" "}
          <span className="text-muted-foreground">raised</span>
        </p>
      )}

      {facts.length > 0 && (
        <p className="text-sm text-muted-foreground">{facts.join(" · ")}</p>
      )}
    </div>
  )
}
