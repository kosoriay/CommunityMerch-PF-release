import { getAllOrgs } from "@/lib/admin"
import Link from "next/link"

export default async function AdminOrgsPage() {
  const orgs = await getAllOrgs()

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Organizations ({orgs.length})</h1>
      <div className="bg-white rounded-lg border divide-y">
        {orgs.map((org) => (
          <div key={org.id} className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between px-4 py-3">
            <div>
              <Link href={`/admin/orgs/${org.id}`} className="font-medium hover:underline">{org.name}</Link>
              <p className="text-xs text-muted-foreground">
                {org.slug} · created {new Date(org.createdAt).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center flex-wrap gap-2 text-xs">
              {org.isInternal && <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded">Internal</span>}
              {org.suspendedAt && <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded">Suspended</span>}
              {org.discountCodeId && <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Discount</span>}
              {org.stripeOnboardingComplete
                ? <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded">Stripe ✓</span>
                : <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">No Stripe</span>}
              <Link href={`/admin/orgs/${org.id}`} className="text-blue-600 hover:underline ml-2">Manage →</Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
