import { db } from "@/lib/db/client"
import { orders, campaigns } from "@/lib/db/schema"
import { eq, inArray, desc } from "drizzle-orm"
import { orderRefundBreakdown } from "@/lib/order-economics"
import { getCatalogItem } from "@/lib/catalog-db"

export type OrgOrder = {
  id: string
  status: string
  createdAt: Date
  buyerName: string | null
  buyerCity: string | null
  buyerState: string | null
  campaignTitle: string
  netToOrgCents: number
  items: { name: string; size: string; quantity: number }[]
}

const ORG_ORDER_LIMIT = 200

/**
 * Orders across an organization's campaigns, for the organization's own view.
 *
 * Only city and state are returned from the shipping address. The print
 * provider ships directly to the buyer, so the organization has no operational
 * need for street addresses, and holding less buyer PII in more places is the
 * direction `openspec/changes/2026-07-24-add-data-lifecycle` sets out.
 */
export async function getOrgOrders(orgId: string): Promise<OrgOrder[]> {
  const orgCampaigns = await db.query.campaigns.findMany({ where: eq(campaigns.orgId, orgId) })
  const ids = orgCampaigns.map((c) => c.id)
  if (ids.length === 0) return []

  const rows = await db.query.orders.findMany({
    where: inArray(orders.campaignId, ids),
    orderBy: [desc(orders.createdAt)],
    limit: ORG_ORDER_LIMIT,
    with: { campaign: true, items: { with: { product: true } } },
  })

  // A pending order is an abandoned checkout, not a sale — showing them would
  // imply money that never arrived.
  const sold = rows.filter((r) => r.status !== "pending")

  return Promise.all(
    sold.map(async (row) => {
      const address = parseCityState(row.shippingAddressJson)
      const { organizationReturnsCents } = orderRefundBreakdown(row)
      const items = await Promise.all(
        row.items.map(async (i) => ({
          name: (await getCatalogItem(i.product.printfulVariantId))?.name
            ?? i.product.printfulVariantId,
          size: i.size,
          quantity: i.quantity,
        }))
      )
      return {
        id: row.id,
        status: row.status,
        createdAt: row.createdAt,
        buyerName: row.buyerName,
        buyerCity: address.city,
        buyerState: address.state,
        campaignTitle: row.campaign.title,
        netToOrgCents: organizationReturnsCents,
        items,
      }
    })
  )
}

function parseCityState(json: string | null): { city: string | null; state: string | null } {
  if (!json) return { city: null, state: null }
  try {
    const parsed = JSON.parse(json) as { city?: string; state?: string }
    return { city: parsed.city ?? null, state: parsed.state ?? null }
  } catch {
    return { city: null, state: null }
  }
}
