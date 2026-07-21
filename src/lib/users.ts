import { db } from "@/lib/db/client"
import { user } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

export type NameValidation = { value: string } | { error: string }

/** Validate a user's display name: trimmed, non-empty, at most 80 chars. */
export function validateUserName(raw: string | null): NameValidation {
  const value = (raw ?? "").trim()
  if (!value) return { error: "Name is required." }
  if (value.length > 80) return { error: "Name must be 80 characters or fewer." }
  return { value }
}

/** Update the display name for a single user. */
export async function updateUserName(userId: string, name: string): Promise<void> {
  await db
    .update(user)
    .set({ name, updatedAt: new Date() })
    .where(eq(user.id, userId))
}
