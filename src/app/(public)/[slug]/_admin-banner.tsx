import Link from "next/link"

export function AdminBanner({ dashboardUrl }: { dashboardUrl: string }) {
  return (
    <div className="bg-blue-700 text-white text-sm px-4 py-2.5 flex items-center justify-between gap-4">
      <span className="font-medium">You are managing this campaign</span>
      <Link
        href={dashboardUrl}
        className="underline underline-offset-2 hover:text-blue-100 transition-colors whitespace-nowrap"
      >
        ← Back to Dashboard
      </Link>
    </div>
  )
}
