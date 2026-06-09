import { db } from "@/lib/db/client"
import { platformConfig } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

export type PlatformConfig = typeof platformConfig.$inferSelect

const SINGLETON_ID = "singleton"

export async function getOrCreateConfig(): Promise<PlatformConfig> {
  const existing = await db.query.platformConfig.findFirst({
    where: eq(platformConfig.id, SINGLETON_ID),
  })
  if (existing) return existing

  const now = new Date()
  // Use onConflictDoNothing to handle concurrent calls from layout + page
  await db.insert(platformConfig).values({
    id: SINGLETON_ID,
    platformName: process.env.PLATFORM_NAME ?? "Community Merch Platform",
    platformTagline: process.env.PLATFORM_TAGLINE ?? "Fundraise with custom merch",
    primaryColor: process.env.PLATFORM_PRIMARY_COLOR ?? "#2E4057",
    accentColor: process.env.PLATFORM_ACCENT_COLOR ?? "#378ADD",
    licenseAgreed: false,
    currentStep: 1,
    setupComplete: false,
    createdAt: now,
    updatedAt: now,
  }).onConflictDoNothing()

  return (await db.query.platformConfig.findFirst({
    where: eq(platformConfig.id, SINGLETON_ID),
  }))!
}

export async function updateConfig(
  data: Partial<Omit<PlatformConfig, "id" | "createdAt" | "updatedAt">>
): Promise<void> {
  await db
    .update(platformConfig)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(platformConfig.id, SINGLETON_ID))
}

export async function advanceStep(nextStep: number): Promise<void> {
  await db
    .update(platformConfig)
    .set({ currentStep: nextStep, updatedAt: new Date() })
    .where(eq(platformConfig.id, SINGLETON_ID))
}

export async function markSetupComplete(): Promise<void> {
  await db
    .update(platformConfig)
    .set({ setupComplete: true, currentStep: 9, updatedAt: new Date() })
    .where(eq(platformConfig.id, SINGLETON_ID))
}

export function isEnvConfigured(keys: string[]): Record<string, boolean> {
  return Object.fromEntries(keys.map((k) => [k, !!process.env[k]]))
}
