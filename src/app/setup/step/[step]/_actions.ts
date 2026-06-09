"use server"

import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { getOrCreateConfig, updateConfig, advanceStep, markSetupComplete } from "@/lib/platform-config"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db/client"
import { user } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

const TOTAL_STEPS = 9

export async function saveStep1Action(formData: FormData): Promise<void> {
  const agreed = formData.get("licenseAgreed") === "on"
  if (!agreed) return
  await getOrCreateConfig()
  await updateConfig({ licenseAgreed: true, currentStep: 2 })
  redirect("/setup/step/2")
}

export async function saveStep2Action(formData: FormData): Promise<void> {
  const platformName = (formData.get("platformName") as string)?.trim()
  const platformTagline = (formData.get("platformTagline") as string)?.trim()
  const primaryColor = (formData.get("primaryColor") as string)?.trim()
  const accentColor = (formData.get("accentColor") as string)?.trim()
  const baseDomain = (formData.get("baseDomain") as string)?.trim() || null
  const supportEmail = (formData.get("supportEmail") as string)?.trim() || null

  if (!platformName) return

  await updateConfig({
    platformName,
    platformTagline: platformTagline || "Fundraise with custom merch",
    primaryColor: primaryColor || "#2E4057",
    accentColor: accentColor || "#378ADD",
    baseDomain,
    supportEmail,
    currentStep: 3,
  })
  redirect("/setup/step/3")
}

// Steps 3–8: service check steps — just advance the step counter
// _formData param required for Next.js form action type compatibility after .bind()
export async function advanceServiceStep(stepNum: number, _formData: FormData): Promise<void> {
  const nextStep = stepNum + 1
  await advanceStep(Math.min(nextStep, TOTAL_STEPS))
  redirect(`/setup/step/${nextStep}`)
}

export async function launchPlatformAction(_formData: FormData): Promise<void> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user.id) redirect("/sign-in")

  const adminEmail = process.env.PLATFORM_ADMIN_EMAIL?.toLowerCase()
  if (adminEmail && session.user.email.toLowerCase() !== adminEmail) {
    redirect("/setup/step/9")
  }

  await db.update(user)
    .set({ platformRole: "platform_admin", updatedAt: new Date() })
    .where(eq(user.id, session.user.id))
  await markSetupComplete()
  redirect("/admin/dashboard")
}
