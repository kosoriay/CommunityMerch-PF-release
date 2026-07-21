"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { validateUserName, updateUserName } from "@/lib/users"

type State = { error?: string; success?: boolean } | undefined

export async function updateAccountAction(_prevState: State, formData: FormData): Promise<State> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/sign-in")

  const result = validateUserName(formData.get("name") as string | null)
  if ("error" in result) return { error: result.error }

  await updateUserName(session.user.id, result.value)
  revalidatePath("/dashboard")
  revalidatePath("/dashboard/account")
  return { success: true }
}
