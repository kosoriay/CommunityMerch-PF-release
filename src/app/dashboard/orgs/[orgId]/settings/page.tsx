import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { auth } from "@/lib/auth"
import { requireOrgAccess } from "@/lib/middleware/require-org-access"
import { getOrg } from "@/lib/orgs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { OrgSettingsForm } from "./_form"
import { DangerZone } from "./_danger-zone"
import { getDeletionBlockers, describeBlocker } from "@/lib/org-lifecycle"

type Props = { params: Promise<{ orgId: string }> }

export default async function OrgSettingsPage({ params }: Props) {
  const { orgId } = await params
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) notFound()

  try {
    await requireOrgAccess(session.user.id, orgId, "admin")
  } catch {
    notFound()
  }

  const org = await getOrg(orgId)
  if (!org) notFound()

  // Every reason deletion is unsafe, resolved server-side so the page can say
  // exactly what is standing in the way rather than offering a button that fails.
  const blockers = await getDeletionBlockers(orgId)
  const blockerReasons = blockers.map((b) => describeBlocker(b, org.name))
  const hasOrders = blockers.some((b) => b.kind === "orders")

  return (
    <div className="max-w-md mx-auto mt-8 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Organization settings</CardTitle>
          <CardDescription>
            Update your organization&apos;s name. The public URL (/{org.slug}) stays the same.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OrgSettingsForm orgId={orgId} initialName={org.name} />
        </CardContent>
      </Card>

      <DangerZone
        orgId={orgId}
        orgName={org.name}
        blockerReasons={blockerReasons}
        hasOrders={hasOrders}
        isClosed={org.closedAt !== null}
      />
    </div>
  )
}
