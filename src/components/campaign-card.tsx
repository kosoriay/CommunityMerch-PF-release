import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDate } from "@/lib/format"

type Status = "draft" | "active" | "closed"

const STATUS_STYLE: Record<Status, string> = {
  active: "bg-green-100 text-green-700",
  draft: "bg-yellow-100 text-yellow-700",
  closed: "bg-slate-100 text-slate-600",
}

type Props = {
  campaign: {
    id: string
    title: string
    slug: string
    status: string
    deadline: Date | null
    orgId: string
  }
}

export function CampaignCard({ campaign }: Props) {
  const status = campaign.status as Status
  const href =
    status === "draft"
      ? `/dashboard/orgs/${campaign.orgId}/campaigns/${campaign.id}/design`
      : `/dashboard/orgs/${campaign.orgId}/campaigns/${campaign.id}/publish`

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{campaign.title}</CardTitle>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[status]}`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">/{campaign.slug}</p>
      </CardHeader>
      <CardContent className="pt-0">
        {campaign.deadline && (
          <p className="text-xs text-muted-foreground mb-3">
            Deadline: {formatDate(campaign.deadline)}
          </p>
        )}
        <Link
          href={href}
          className="text-sm text-blue-600 hover:underline font-medium"
        >
          {status === "draft" ? "Continue editing →" : "View campaign →"}
        </Link>
      </CardContent>
    </Card>
  )
}
