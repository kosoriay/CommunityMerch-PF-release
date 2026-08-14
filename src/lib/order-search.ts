// Buyers never see a full order UUID. The confirmation page and the
// confirmation email both show `id.slice(0, 8).toUpperCase()`, so the string a
// buyer quotes in a support email is an 8-character uppercase hex prefix.
// Lookup has to match on that prefix, on a pasted full UUID, and on the buyer's
// email address or name — whichever the buyer happened to give us.

export type OrderQuery = {
  /** Lower-cased prefix for matching against `orders.id`. */
  idPrefix: string
  /** Substring for matching against buyer email and name. */
  contains: string
}

/** Returns null when there is nothing to search for. */
export function parseOrderQuery(raw: string): OrderQuery | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  return {
    idPrefix: escapeLike(trimmed.toLowerCase()),
    contains: escapeLike(trimmed),
  }
}

/**
 * Escape LIKE wildcards so a query containing `%` matches literally instead of
 * returning every order. Pair with `ESCAPE '\'` in the SQL.
 */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`)
}

/** Short form shown to buyers — keep every display of an order id going through this. */
export function shortOrderId(orderId: string): string {
  return orderId.slice(0, 8).toUpperCase()
}
