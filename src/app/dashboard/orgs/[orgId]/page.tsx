import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { auth } from "@/lib/auth"
import { requireOrgAccess } from "@/lib/middleware/require-org-access"
import { getOrg, getOrgMembers } from "@/lib/orgs"
import { buttonVariants } from "@/components/ui/button"
import Link from "next/link"

type Props = { params: Promise<{ orgId: string }> }

export default async function OrgPage({ params }: Props) {
  const { orgId } = await params
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) notFound()

  let membership
  try {
    membership = await requireOrgAccess(session.user.id, orgId, "buyer")
  } catch {
    notFound()
  }

  const [org, members] = await Promise.all([getOrg(orgId), getOrgMembers(orgId)])
  if (!org) notFound()

  const isAdmin = membership.role === "admin"

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#2E4057]">{org.name}</h1>
          <p className="text-muted-foreground text-sm">/{org.slug}</p>
        </div>
        {isAdmin && (
          <Link href={`/dashboard/orgs/${orgId}/members`} className={buttonVariants()}>
            Manage Members
          </Link>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border bg-white p-4">
          <p className="text-sm text-muted-foreground">Members</p>
          <p className="text-3xl font-semibold mt-1">{members.length}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-sm text-muted-foreground">Your role</p>
          <p className="text-3xl font-semibold mt-1 capitalize">{membership.role}</p>
        </div>
      </div>

      <div className="rounded-lg border bg-white p-4 flex items-center justify-between">
        <p className="text-muted-foreground text-sm">No campaigns yet.</p>
        <Link
          href={`/dashboard/orgs/${orgId}/campaigns/new`}
          className={buttonVariants()}
        >
          New Campaign
        </Link>
      </div>
    </div>
  )
}
