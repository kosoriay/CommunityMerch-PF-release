import { getPlatformStaff } from "@/lib/admin"
import { removeRoleAction } from "./_actions"
import { Button } from "@/components/ui/button"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { AssignRoleForm } from "./_form"

function formatRole(role: string | null): string {
  if (!role) return ""
  return role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

export default async function AdminStaffPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (session?.user.platformRole !== "platform_admin") redirect("/admin/dashboard")

  const staff = await getPlatformStaff()

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Platform Staff</h1>

      <div className="bg-white rounded-lg border">
        <h2 className="font-semibold px-4 py-3 border-b">Current Staff ({staff.length})</h2>
        {staff.length === 0 && (
          <p className="px-4 py-6 text-sm text-muted-foreground text-center">No platform staff yet.</p>
        )}
        <div className="divide-y">
          {staff.map((member) => (
            <div key={member.id} className="flex flex-wrap items-center justify-between px-4 py-3 gap-2">
              <div>
                <p className="text-sm font-medium">{member.email}</p>
                <p className="text-xs text-muted-foreground">{formatRole(member.platformRole)}</p>
              </div>
              <form action={removeRoleAction.bind(null, member.id)}>
                <Button type="submit" variant="outline" size="sm">Remove</Button>
              </form>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg border p-4 space-y-4 w-full md:max-w-md">
        <h2 className="font-semibold">Assign Platform Role</h2>
        <p className="text-sm text-muted-foreground">The user must already have an account.</p>
        <AssignRoleForm />
      </div>
    </div>
  )
}
