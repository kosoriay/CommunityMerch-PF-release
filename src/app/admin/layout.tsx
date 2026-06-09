import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { AdminNav } from "./_components/AdminNav"
import { FeedbackWidget } from "./_components/FeedbackWidget"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session?.user.platformRole) redirect("/dashboard")

  const isAdmin = session.user.platformRole === "platform_admin"

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminNav
        email={session.user.email}
        platformRole={session.user.platformRole}
        isAdmin={isAdmin}
      />
      <main className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-8">
        {children}
      </main>
      <FeedbackWidget />
    </div>
  )
}
