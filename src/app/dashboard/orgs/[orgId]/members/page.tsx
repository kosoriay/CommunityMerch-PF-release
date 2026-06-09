import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { auth } from "@/lib/auth"
import { requireOrgAccess } from "@/lib/middleware/require-org-access"
import { getOrgMembers } from "@/lib/orgs"
import { inviteMemberAction, removeMemberAction, changeRoleAction } from "./_actions"
import type { OrgRole } from "@/lib/middleware/require-org-access"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type Props = { params: Promise<{ orgId: string }> }

export default async function MembersPage({ params }: Props) {
  const { orgId } = await params
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) notFound()

  let membership
  try {
    membership = await requireOrgAccess(session.user.id, orgId, "member")
  } catch {
    notFound()
  }

  const members = await getOrgMembers(orgId)
  const isAdmin = membership.role === "admin"

  type FormAction = (formData: FormData) => Promise<void>

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-[#2E4057]">Members</h2>

      <div className="rounded-lg border bg-white divide-y">
        {members.map((m) => (
          <div key={m.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="font-medium text-sm">{m.user.name ?? m.user.email}</p>
              <p className="text-xs text-muted-foreground">{m.user.email}</p>
            </div>
            <div className="flex items-center gap-3">
              {isAdmin && m.userId !== session.user.id ? (
                <>
                  <form
                    action={changeRoleAction.bind(null, orgId, m.userId, m.role === "admin" ? "member" as OrgRole : "admin" as OrgRole) as unknown as FormAction}
                  >
                    <button type="submit" className="text-xs underline text-muted-foreground hover:text-foreground">
                      {m.role === "admin" ? "Demote" : "Make Admin"}
                    </button>
                  </form>
                  <form action={removeMemberAction.bind(null, orgId, m.userId) as unknown as FormAction}>
                    <button type="submit" className="text-xs underline text-red-500 hover:text-red-700">
                      Remove
                    </button>
                  </form>
                </>
              ) : (
                <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600 capitalize">
                  {m.role}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invite a member</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              action={inviteMemberAction.bind(null, orgId) as unknown as FormAction}
              className="flex gap-3 flex-wrap"
            >
              <div className="flex-1 min-w-48 space-y-1">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="member@example.com"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="role">Role</Label>
                <select
                  id="role"
                  name="role"
                  defaultValue="member"
                  className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                >
                  <option value="admin">Admin</option>
                  <option value="member">Member</option>
                  <option value="student">Student</option>
                  <option value="buyer">Buyer</option>
                </select>
              </div>
              <div className="flex items-end">
                <Button type="submit">Send Invite</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
