import "server-only"
import { db } from "@/lib/db/client"
import { campaignProducts, designs, printfulCatalog } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { generateMockup } from "@/lib/providers/printful-mockup"

export async function generateCampaignMockups(campaignId: string): Promise<void> {
  const [design] = await db.select().from(designs).where(eq(designs.campaignId, campaignId))
  if (!design?.designFileUrl) return

  const products = await db
    .select()
    .from(campaignProducts)
    .where(eq(campaignProducts.campaignId, campaignId))

  for (const product of products) {
    try {
      const [catalogEntry] = await db
        .select()
        .from(printfulCatalog)
        .where(eq(printfulCatalog.id, product.printfulVariantId))

      if (!catalogEntry?.defaultMockupVariantId) continue

      const mockupUrl = await generateMockup(
        design.designFileUrl,
        catalogEntry.printfulProductId,
        catalogEntry.defaultMockupVariantId
      )

      await db
        .update(campaignProducts)
        .set({ mockupUrl, mockupGeneratedAt: new Date() })
        .where(eq(campaignProducts.id, product.id))
    } catch {
      // Partial failure is acceptable — this product falls back to catalogImageUrl
    }
  }
}
