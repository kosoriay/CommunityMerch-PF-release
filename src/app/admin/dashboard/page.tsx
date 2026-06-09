import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { getPlatformStats, getRecentOrgs, formatRevenueDollars } from "@/lib/admin"
import { listDiscountCodes } from "@/lib/discount-codes"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default async function AdminDashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  const isAdmin = session?.user.platformRole === "platform_admin"

  const [stats, recentOrgs, allCodes] = await Promise.all([
    getPlatformStats(),
    getRecentOrgs(5),
    isAdmin ? listDiscountCodes() : Promise.resolve([]),
  ])

  const activeCodes = allCodes.filter((c) => c.isActive)

  return (
    <div className="space-y-6 md:space-y-8">
      <h1 className="text-2xl font-bold">Platform Overview</h1>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Organizations", value: stats.orgCount },
          { label: "Active Campaigns", value: stats.activeCampaigns },
          { label: "Total Orders", value: stats.orderCount },
          { label: "Revenue", value: formatRevenueDollars(stats.totalRevenueCents) },
          { label: "Suspended Orgs", value: stats.suspendedCount },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">{stat.label}</p>
            <p className="text-2xl font-bold mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Recent orgs */}
      <div className="bg-white rounded-lg border">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="font-semibold">Recent Organizations</h2>
          <Link href="/admin/orgs" className="text-sm text-blue-600 hover:underline">View all →</Link>
        </div>
        <div className="divide-y">
          {recentOrgs.map((org) => (
            <div key={org.id} className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between px-4 py-3">
              <div>
                <Link href={`/admin/orgs/${org.id}`} className="font-medium hover:underline">{org.name}</Link>
                <p className="text-xs text-muted-foreground">{org.slug}</p>
              </div>
              <div className="flex items-center flex-wrap gap-2 text-xs">
                {org.isInternal && <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded">Internal</span>}
                {org.suspendedAt && <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded">Suspended</span>}
                {org.stripeOnboardingComplete
                  ? <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded">Stripe ✓</span>
                  : <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">No Stripe</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Active discount codes (platform_admin only) */}
      {isAdmin && (
        <div className="bg-white rounded-lg border">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h2 className="font-semibold">Active Discount Codes</h2>
            <Link href="/admin/discount-codes/new" className="text-sm text-blue-600 hover:underline">+ New code</Link>
          </div>
          {activeCodes.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground text-center">No active codes.</p>
          ) : (
            <div className="divide-y">
              {activeCodes.map((code) => (
                <div key={code.id} className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between px-4 py-3">
                  <div>
                    <span className="font-mono font-medium">{code.code}</span>
                    <p className="text-xs text-muted-foreground">
                      {code.discountType === "fee_waiver" ? "Fee waiver" : `${code.discountValue}% off fee`}
                      {" · "}
                      {code.currentUses}{code.maxUses !== null ? `/${code.maxUses}` : ""} uses
                      {code.expiresAt && ` · exp. ${new Date(code.expiresAt).toLocaleDateString()}`}
                    </p>
                  </div>
                  <Link href="/admin/discount-codes">
                    <Button variant="outline" size="sm">Manage</Button>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Quick actions */}
      {isAdmin && (
        <div className="flex flex-wrap gap-3">
          <Link href="/admin/discount-codes/new">
            <Button>+ Create Discount Code</Button>
          </Link>
          <Link href="/admin/orgs">
            <Button variant="outline">View All Organizations</Button>
          </Link>
        </div>
      )}
    </div>
  )
}
