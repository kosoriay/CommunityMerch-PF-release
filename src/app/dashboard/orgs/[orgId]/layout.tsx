import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { auth } from "@/lib/auth"
import { requireOrgAccess } from "@/lib/middleware/require-org-access"
import { getOrg } from "@/lib/orgs"
import Link from "next/link"

type Props = {
  children: React.ReactNode
  params: Promise<{ orgId: string }>
}

export default async function OrgLayout({ children, params }: Props) {
  const { orgId } = await params
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) notFound()

  let membership
  try {
    membership = await requireOrgAccess(session.user.id, orgId, "buyer")
  } catch {
    notFound()
  }

  const org = await getOrg(orgId)
  if (!org) notFound()

  const isAdminOrMember = ["admin", "member"].includes(membership.role)

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <Link href="/dashboard" className="hover:text-foreground">Dashboard</Link>
          <span>/</span>
          <span className="text-foreground font-medium">{org.name}</span>
        </div>
        <nav className="flex gap-1 border-b">
          <Link
            href={`/dashboard/orgs/${orgId}`}
            className="px-4 py-2 text-sm hover:bg-slate-100 rounded-t"
          >
            Overview
          </Link>
          <Link
            href={`/dashboard/orgs/${orgId}/campaigns`}
            className="px-4 py-2 text-sm hover:bg-slate-100 rounded-t"
          >
            Campaigns
          </Link>
          {isAdminOrMember && (
            <Link
              href={`/dashboard/orgs/${orgId}/members`}
              className="px-4 py-2 text-sm hover:bg-slate-100 rounded-t"
            >
              Members
            </Link>
          )}
        </nav>
      </div>
      {children}
    </div>
  )
}
