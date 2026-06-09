import { headers } from "next/headers"
import Link from "next/link"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { getOrgsForUser } from "@/lib/orgs"
import { buttonVariants } from "@/components/ui/button"
import { OrgCard } from "@/components/org-card"

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/sign-in")
  const orgs = await getOrgsForUser(session.user.id)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-[#2E4057]">Your Organizations</h1>
        <Link href="/dashboard/orgs/new" className={buttonVariants()}>
          New Organization
        </Link>
      </div>

      {orgs.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="mb-4 text-lg">You're not a member of any organization yet.</p>
          <Link href="/dashboard/orgs/new" className={buttonVariants()}>
            Create your first organization
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {orgs.map(({ org, membership }) => (
            <OrgCard key={org.id} org={org} role={membership.role} />
          ))}
        </div>
      )}
    </div>
  )
}
