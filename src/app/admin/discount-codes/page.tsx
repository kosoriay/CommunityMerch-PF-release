import { listDiscountCodes } from "@/lib/discount-codes"
import { deactivateCodeAction } from "./_actions"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"

export default async function AdminDiscountCodesPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (session?.user.platformRole !== "platform_admin") redirect("/admin/dashboard")

  const codes = await listDiscountCodes()

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Discount Codes</h1>
        <Link href="/admin/discount-codes/new">
          <Button>+ New Code</Button>
        </Link>
      </div>

      <div className="bg-white rounded-lg border divide-y">
        {codes.length === 0 && (
          <p className="px-4 py-6 text-sm text-muted-foreground text-center">No discount codes yet.</p>
        )}
        {codes.map((code) => (
          <div key={code.id} className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between px-4 py-3">
            <div>
              <span className="font-mono font-medium">{code.code}</span>
              <p className="text-xs text-muted-foreground mt-0.5">
                {code.discountType === "fee_waiver" ? "Fee waiver" : `${code.discountValue}% off platform fee`}
                {" · "}
                {code.currentUses}{code.maxUses !== null ? `/${code.maxUses} uses` : " uses (unlimited)"}
                {code.campaignLimit !== null && ` · ${code.campaignLimit} campaigns/org`}
                {code.expiresAt && ` · exp. ${new Date(code.expiresAt).toLocaleDateString()}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {code.isActive ? (
                <form action={deactivateCodeAction.bind(null, code.id)}>
                  <Button type="submit" variant="destructive" size="sm">Disable</Button>
                </form>
              ) : (
                <span className="text-xs text-muted-foreground">
                  Deactivated {code.deactivatedAt ? new Date(code.deactivatedAt).toLocaleDateString() : ""}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
