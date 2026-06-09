import { db } from "@/lib/db/client"
import { discountCodes, organizations } from "@/lib/db/schema"
import { eq, sql } from "drizzle-orm"
import type { InferSelectModel } from "drizzle-orm"

export type DiscountCode = InferSelectModel<typeof discountCodes>

type OrgContext = { isInternal: boolean | null; discountCodeId: string | null }

// Pure function — no DB access. Safe to call in tests.
export function getPlatformFeeRate(
  org: OrgContext,
  code: Pick<DiscountCode, "isActive" | "discountType" | "discountValue"> | null
): number {
  if (org.isInternal) return 0
  if (!code || !code.isActive) return 0.09
  if (code.discountType === "fee_waiver") return 0
  return 0.09 * (1 - code.discountValue / 100)
}

export async function getActiveCodeForOrg(orgId: string): Promise<DiscountCode | null> {
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, orgId),
  })
  if (!org?.discountCodeId) return null
  const found = await db.query.discountCodes.findFirst({
    where: eq(discountCodes.id, org.discountCodeId),
  })
  return found ?? null
}

export async function validateAndGetCode(
  codeStr: string
): Promise<{ code: DiscountCode | null; error?: string }> {
  const code = await db.query.discountCodes.findFirst({
    where: eq(discountCodes.code, codeStr.toUpperCase()),
  })
  if (!code) return { code: null, error: "Discount code not found" }
  if (!code.isActive) return { code: null, error: "This code has been deactivated" }
  if (code.expiresAt && code.expiresAt < new Date()) return { code: null, error: "This code has expired" }
  if (code.maxUses !== null && code.currentUses >= code.maxUses) {
    return { code: null, error: "This code has reached its maximum usage limit" }
  }
  return { code }
}

export async function applyDiscountCodeToOrg(
  orgId: string,
  codeStr: string
): Promise<{ error?: string }> {
  const { code, error } = await validateAndGetCode(codeStr)
  if (!code) return { error }
  const now = new Date()
  await db.transaction(async (tx) => {
    await tx.update(organizations)
      .set({ discountCodeId: code.id, updatedAt: now })
      .where(eq(organizations.id, orgId))
    // Atomic increment — never read-then-write
    await tx.update(discountCodes)
      .set({ currentUses: sql`${discountCodes.currentUses} + 1`, updatedAt: now })
      .where(eq(discountCodes.id, code.id))
  })
  return {}
}

export async function removeDiscountCodeFromOrg(orgId: string): Promise<void> {
  await db.update(organizations)
    .set({ discountCodeId: null, updatedAt: new Date() })
    .where(eq(organizations.id, orgId))
}

export async function createDiscountCode(data: {
  code: string
  discountType: "fee_percentage" | "fee_waiver"
  discountValue: number
  campaignLimit?: number | null
  maxUses?: number | null
  expiresAt?: Date | null
  createdBy: string
}): Promise<DiscountCode> {
  const now = new Date()
  const [created] = await db.insert(discountCodes).values({
    id: crypto.randomUUID(),
    code: data.code.toUpperCase(),
    discountType: data.discountType,
    discountValue: data.discountValue,
    campaignLimit: data.campaignLimit ?? null,
    maxUses: data.maxUses ?? null,
    currentUses: 0,
    expiresAt: data.expiresAt ?? null,
    isActive: true,
    createdBy: data.createdBy,
    createdAt: now,
    updatedAt: now,
  }).returning()
  return created
}

export async function deactivateDiscountCode(id: string): Promise<void> {
  const now = new Date()
  await db.update(discountCodes)
    .set({ isActive: false, deactivatedAt: now, updatedAt: now })
    .where(eq(discountCodes.id, id))
}

export async function listDiscountCodes(): Promise<DiscountCode[]> {
  return db.query.discountCodes.findMany({
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  })
}
