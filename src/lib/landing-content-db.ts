import { eq } from "drizzle-orm"
import { db } from "@/lib/db/client"
import { landingContent } from "@/lib/db/schema"
import {
  parseStoredContent,
  resolveLandingContent,
  type EffectiveLandingContent,
  type StoredLandingContent,
} from "@/lib/landing-content"

const SINGLETON_ID = "singleton"

export async function getStoredLandingContent(): Promise<StoredLandingContent> {
  const row = await db.query.landingContent.findFirst({
    where: eq(landingContent.id, SINGLETON_ID),
  })
  return parseStoredContent(row?.content)
}

export async function getLandingContent(): Promise<EffectiveLandingContent> {
  return resolveLandingContent(await getStoredLandingContent())
}

export async function updateLandingContent(doc: StoredLandingContent): Promise<void> {
  const content = JSON.stringify(doc)
  const now = new Date()
  await db
    .insert(landingContent)
    .values({ id: SINGLETON_ID, content, updatedAt: now })
    .onConflictDoUpdate({ target: landingContent.id, set: { content, updatedAt: now } })
}
