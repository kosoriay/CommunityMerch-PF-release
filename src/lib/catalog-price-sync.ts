// Decision logic for the weekly Printful price sync cron.
// Pure and separated from the route so the guardrail is unit-testable.

// Reject fetched prices that differ from the stored cost by more than ±25% —
// protects against API glitches, currency surprises, and wrong-variant reads.
// A legitimate change this large deserves a human look (update the catalog
// constants in a release instead).
export const PRICE_CHANGE_GUARDRAIL = 0.25

export type PriceSyncDecision =
  | { action: "update"; newPodCostCents: number }
  | { action: "unchanged" }
  | { action: "skipped"; reason: string }

export function decidePodCostUpdate(
  currentCents: number,
  fetchedCents: number | null
): PriceSyncDecision {
  if (fetchedCents === null || !Number.isFinite(fetchedCents) || fetchedCents <= 0) {
    return { action: "skipped", reason: "invalid fetched price" }
  }
  if (fetchedCents === currentCents) {
    return { action: "unchanged" }
  }
  if (currentCents <= 0) {
    return { action: "skipped", reason: "invalid stored price" }
  }
  const change = Math.abs(fetchedCents - currentCents) / currentCents
  if (change > PRICE_CHANGE_GUARDRAIL) {
    return {
      action: "skipped",
      reason: `change of ${Math.round(change * 100)}% exceeds the ±${PRICE_CHANGE_GUARDRAIL * 100}% guardrail`,
    }
  }
  return { action: "update", newPodCostCents: fetchedCents }
}
