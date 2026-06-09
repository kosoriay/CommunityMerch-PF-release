import { notFound } from "next/navigation"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { getAdminOrgById } from "@/lib/admin"
import { db } from "@/lib/db/client"
import { campaigns, orgMembers, discountCodes } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import {
  suspendOrgAction, unsuspendOrgAction, toggleInternalAction,
  applyCodeFormAction, removeCodeAction
} from "./_actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export default async function AdminOrgDetailPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params
  const session = await auth.api.getSession({ headers: await headers() })
  const isAdmin = session?.user.platformRole === "platform_admin"

  const [org, orgCampaigns, members] = await Promise.all([
    getAdminOrgById(orgId),
    db.query.campaigns.findMany({ where: eq(campaigns.orgId, orgId), orderBy: (t, { desc }) => [desc(t.createdAt)] }),
    db.query.orgMembers.findMany({ where: eq(orgMembers.orgId, orgId), with: { user: true } }),
  ])

  if (!org) notFound()

  const discountCode = org.discountCodeId
    ? await db.query.discountCodes.findFirst({ where: eq(discountCodes.id, org.discountCodeId) })
    : null

  const isSuspended = !!org.suspendedAt

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{org.name}</h1>
          <p className="text-sm text-muted-foreground">{org.slug} · created {new Date(org.createdAt).toLocaleDateString()}</p>
        </div>
        <div className="flex gap-2 text-xs">
          {org.isInternal && <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded">Internal</span>}
          {isSuspended && <span className="bg-red-100 text-red-700 px-2 py-1 rounded">Suspended</span>}
        </div>
      </div>

      {isAdmin && (
        <div className="bg-white rounded-lg border p-4 space-y-4">
          <h2 className="font-semibold">Actions</h2>

          <div className="flex flex-wrap gap-2">
            {isSuspended ? (
              <form action={unsuspendOrgAction.bind(null, orgId)}>
                <Button type="submit" variant="outline">Unsuspend Org</Button>
              </form>
            ) : (
              <form action={suspendOrgAction.bind(null, orgId)}>
                <Button type="submit" variant="destructive">Suspend Org</Button>
              </form>
            )}
            <form action={toggleInternalAction.bind(null, orgId, !org.isInternal)}>
              <Button type="submit" variant="outline">
                {org.isInternal ? "Remove Internal Flag" : "Mark as Internal"}
              </Button>
            </form>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Discount Code</p>
            {org.discountCodeId ? (
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm bg-slate-100 px-2 py-1 rounded">
                  {discountCode?.code ?? org.discountCodeId}
                </span>
                <form action={removeCodeAction.bind(null, orgId)}>
                  <Button type="submit" variant="outline" size="sm">Remove</Button>
                </form>
              </div>
            ) : (
              <form action={applyCodeFormAction.bind(null, orgId)} className="flex flex-wrap gap-2">
                <Input name="code" placeholder="LAUNCH2026" className="w-full max-w-[10rem]" />
                <Button type="submit" size="sm">Apply Code</Button>
              </form>
            )}
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border">
        <h2 className="font-semibold px-4 py-3 border-b">Members ({members.length})</h2>
        <div className="divide-y">
          {members.map((m) => (
            <div key={m.id} className="flex flex-wrap justify-between px-4 py-2 text-sm gap-1">
              <span>{m.user.email}</span>
              <span className="text-muted-foreground capitalize">{m.role}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg border">
        <h2 className="font-semibold px-4 py-3 border-b">Campaigns ({orgCampaigns.length})</h2>
        <div className="divide-y">
          {orgCampaigns.map((c) => (
            <div key={c.id} className="flex flex-wrap justify-between px-4 py-2 text-sm gap-1">
              <span>{c.title}</span>
              <span className="capitalize text-muted-foreground">{c.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
