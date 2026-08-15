// A single checkout is capped by total value, not by item count. Counting items
// doesn't bound anything useful: the per-item cap of 10 is trivially sidestepped
// by adding more product types, so a 10-product campaign already allows ~100
// units in one order.
//
// What the cap actually bounds is per-order exposure. The platform owner pays
// Printful up front and is reimbursed by Stripe days later, and carries the full
// chargeback loss (`losses.payments: application`) on merchandise that has
// already been printed and shipped. Both scale with order value.
//
// It is a speed bump, not fraud prevention — a determined buyer can split into
// several checkouts. That is fine: each charge is then separately bounded and
// separately disputable, and repeated checkouts are more visible to Stripe Radar
// than one large one.

/** $500 — roughly 20 tees. Comfortably above ordinary PTA buying. */
export const DEFAULT_MAX_ORDER_TOTAL_CENTS = 50_000

/**
 * Resolve the per-order cap from `MAX_ORDER_TOTAL_CENTS`.
 * Missing, unparseable, or non-positive values fall back to the default rather
 * than disabling the cap — a typo in an env var must not silently remove it.
 */
export function resolveMaxOrderTotalCents(
  raw: string | undefined = process.env.MAX_ORDER_TOTAL_CENTS
): number {
  if (raw === undefined || raw.trim() === "") return DEFAULT_MAX_ORDER_TOTAL_CENTS
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
    return DEFAULT_MAX_ORDER_TOTAL_CENTS
  }
  return parsed
}
