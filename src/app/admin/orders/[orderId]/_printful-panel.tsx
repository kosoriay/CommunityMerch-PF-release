import { printfulFixGuidance, printfulUncheckedGuidance } from "@/lib/printful-status"

type Props = {
  category: "printful_stuck" | "printful_unchecked"
  printfulStatus: string | null
  printfulStatusReason: string | null
  printfulCheckError: string | null
  printfulOrderId: string | null
  checkedAt: Date | null
}

/**
 * Printful accepted the order, and then either stopped it or could not be asked
 * about it (設計 2026-09-21 §6.2・§6.3). No retry button: the order already exists
 * at Printful, and the fix happens there.
 */
export function PrintfulStatusPanel({
  category,
  printfulStatus,
  printfulStatusReason,
  printfulCheckError,
  printfulOrderId,
  checkedAt,
}: Props) {
  const stuck = category === "printful_stuck"
  return (
    <div className="rounded-lg border border-red-300 bg-red-50">
      <div className="px-4 py-3 border-b border-red-200">
        <h2 className="font-semibold text-red-900 text-sm">
          {stuck ? `Stopped at Printful — ${printfulStatus}` : "Printful status not confirmed"}
        </h2>
        <p className="text-sm text-red-800 mt-1">
          The buyer has paid. Nothing ships until this is resolved.
        </p>
      </div>
      <div className="px-4 py-4 space-y-2 text-sm text-red-900 break-words">
        {stuck && printfulStatusReason && (
          <p>
            <span className="text-xs text-red-700 uppercase tracking-wide">Reason</span>
            <br />
            {printfulStatusReason}
          </p>
        )}
        <p>{stuck ? printfulFixGuidance(printfulStatus ?? "") : printfulUncheckedGuidance(printfulCheckError)}</p>
        {stuck && printfulCheckError && (
          <p className="text-xs text-red-700">Last check failed: {printfulCheckError}</p>
        )}
        <p className="text-xs text-red-700">
          Printful order {printfulOrderId ? `#${printfulOrderId}` : "unknown"} · last checked{" "}
          {checkedAt ? new Date(checkedAt).toLocaleString() : "never"}
        </p>
      </div>
    </div>
  )
}
