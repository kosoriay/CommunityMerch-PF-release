import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { OrgRole } from "@/lib/middleware/require-org-access"

const ROLE_LABEL: Record<OrgRole, string> = {
  admin: "Admin",
  member: "Member",
  student: "Student",
  buyer: "Buyer",
}

type Props = {
  org: { id: string; name: string; slug: string }
  role: OrgRole
}

export function OrgCard({ org, role }: Props) {
  return (
    <Link href={`/dashboard/orgs/${org.id}`} aria-label={`${org.name} — ${ROLE_LABEL[role] ?? role}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
        <CardHeader>
          <CardTitle className="text-lg">{org.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600 font-medium">
            {ROLE_LABEL[role] ?? role}
          </span>
          <p className="text-sm text-muted-foreground mt-2">/{org.slug}</p>
        </CardContent>
      </Card>
    </Link>
  )
}
