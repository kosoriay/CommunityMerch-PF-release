import Link from "next/link"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { getStoredLandingContent } from "@/lib/landing-content-db"
import { LandingEditorForm } from "./_form"

export default async function AdminLandingPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (session?.user.platformRole !== "platform_admin") redirect("/admin/dashboard")

  const stored = await getStoredLandingContent()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Landing Page</h1>
        <Link href="/" target="_blank" rel="noopener" className="text-sm text-blue-600 hover:underline">
          View landing page ↗
        </Link>
      </div>
      <p className="text-sm text-muted-foreground max-w-2xl">
        Sections marked <strong>Default</strong> keep receiving copy improvements from platform
        updates. Editing a section pins it to your text; “Reset to default” un-pins it. Impact
        stats are computed from real orders and cannot be edited. Testimonials and the stats band
        stay hidden on the landing page until there is something real to show.
      </p>
      <LandingEditorForm stored={stored} />
    </div>
  )
}
