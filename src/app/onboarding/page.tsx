import { Suspense } from "react"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { getOrgsForUser } from "@/lib/orgs"
import { hasRole } from "@/lib/middleware/require-org-access"
import { OnboardingForm } from "./_form"

type Props = { searchParams: Promise<{ d?: string }> }

export default async function OnboardingPage({ searchParams }: Props) {
  const { d } = await searchParams
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    const cb = `/onboarding${d ? `?d=${d}` : ""}`
    redirect(`/sign-in?callbackUrl=${encodeURIComponent(cb)}`)
  }

  const orgs = await getOrgsForUser(session.user.id)
  const eligible = orgs.filter((o) => hasRole(o.membership.role, "member"))
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
      <Suspense>
        <OnboardingForm
          defaultName={session.user.name}
          existingOrgs={eligible.map((o) => ({ id: o.org.id, name: o.org.name }))}
        />
      </Suspense>
    </div>
  )
}
