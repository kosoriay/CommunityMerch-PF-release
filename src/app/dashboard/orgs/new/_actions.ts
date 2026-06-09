"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { createOrg, generateSlug } from "@/lib/orgs"

export async function createOrgAction(_prevState: { error?: string } | undefined, formData: FormData) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/sign-in")

  const name = (formData.get("name") as string | null)?.trim() ?? ""
  if (!name || name.length < 2) return { error: "Name must be at least 2 characters." }
  if (name.length > 80) return { error: "Name must be 80 characters or fewer." }
  if (!generateSlug(name)) return { error: "Name must contain at least one letter or number." }

  const org = await createOrg(name, session.user.id)
  redirect(`/dashboard/orgs/${org.id}`)
}
