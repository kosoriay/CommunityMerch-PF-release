"use server"

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { validateLandingContent } from "@/lib/landing-content"
import { updateLandingContent } from "@/lib/landing-content-db"

export type SaveState = { error?: string; saved?: boolean }

export async function saveLandingContentAction(
  _prev: SaveState,
  formData: FormData
): Promise<SaveState> {
  // Re-check the role here — never trust the page gate alone (design D4).
  const session = await auth.api.getSession({ headers: await headers() })
  if (session?.user.platformRole !== "platform_admin") {
    return { error: "Unauthorized." }
  }

  const raw = formData.get("content")
  if (typeof raw !== "string") return { error: "Missing content." }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { error: "Content is not valid JSON." }
  }

  const result = validateLandingContent(parsed)
  if (!result.ok) return { error: result.error }

  await updateLandingContent(result.value)
  revalidatePath("/")
  return { saved: true }
}
