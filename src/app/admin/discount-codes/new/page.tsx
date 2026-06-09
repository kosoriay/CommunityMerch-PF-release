import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { NewDiscountCodeForm } from "./_form"

export default async function NewDiscountCodePage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (session?.user.platformRole !== "platform_admin") redirect("/admin/dashboard")
  return <NewDiscountCodeForm />
}
