"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { assignPlatformRole, removePlatformRole, findUserByEmail } from "@/lib/admin"

async function requirePlatformAdmin() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (session?.user.platformRole !== "platform_admin") redirect("/admin/dashboard")
  return session
}

export async function assignRoleAction(
  _prev: { error?: string } | undefined,
  formData: FormData
): Promise<{ error?: string }> {
  const session = await requirePlatformAdmin()
  const email = (formData.get("email") as string).trim().toLowerCase()
  const rawRole = formData.get("role") as string
  if (rawRole !== "platform_admin" && rawRole !== "platform_staff") {
    return { error: "Invalid role" }
  }
  const role = rawRole as "platform_admin" | "platform_staff"

  if (!email) return { error: "Email is required" }

  const targetUser = await findUserByEmail(email)
  if (!targetUser) return { error: `No user found with email: ${email}` }
  if (targetUser.id === session.user.id) return { error: "You cannot change your own role" }

  await assignPlatformRole(targetUser.id, role)
  revalidatePath("/admin/staff")
  return {}
}

export async function removeRoleAction(userId: string): Promise<void> {
  const session = await requirePlatformAdmin()
  if (userId === session.user.id) return
  await removePlatformRole(userId)
  revalidatePath("/admin/staff")
}
