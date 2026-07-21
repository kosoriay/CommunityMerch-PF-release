import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { getInvitationByToken } from "@/lib/invitations"
import { AcceptForm } from "./_accept-form"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"

type Props = { params: Promise<{ token: string }> }

export default async function InvitePage({ params }: Props) {
  const { token } = await params
  const session = await auth.api.getSession({ headers: await headers() })
  const invitation = await getInvitationByToken(token)

  if (!invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Card className="max-w-sm w-full">
          <CardHeader>
            <CardTitle>Invalid invitation</CardTitle>
            <CardDescription>This invitation link is invalid or has expired.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/" className={buttonVariants({ variant: "outline" })}>Go home</Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const isExpired = invitation.expiresAt < new Date()
  const isUsed = !!invitation.acceptedAt

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <Card className="max-w-sm w-full">
        <CardHeader>
          <CardTitle>Join {invitation.org.name}</CardTitle>
          <CardDescription>
            You&apos;ve been invited to join as a{" "}
            <strong className="capitalize">{invitation.role}</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isExpired && (
            <p className="text-sm text-red-600">This invitation has expired.</p>
          )}
          {isUsed && (
            <p className="text-sm text-muted-foreground">This invitation has already been accepted.</p>
          )}
          {!isExpired && !isUsed && !session && (
            <>
              <p className="text-sm text-muted-foreground">
                Sign in to accept this invitation.
              </p>
              <Link
                href={`/sign-in?callbackUrl=/invite/${token}`}
                className={buttonVariants({ className: "w-full" })}
              >
                Sign in to accept
              </Link>
            </>
          )}
          {!isExpired && !isUsed && session && (
            <AcceptForm token={token} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
