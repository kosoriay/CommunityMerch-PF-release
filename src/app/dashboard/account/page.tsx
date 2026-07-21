import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AccountForm } from "./_form"

export default async function AccountPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/sign-in")

  return (
    <div className="max-w-md mx-auto mt-8">
      <Card>
        <CardHeader>
          <CardTitle>Account settings</CardTitle>
          <CardDescription>
            Update your display name. Your email ({session.user.email}) can&apos;t be changed here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AccountForm initialName={session.user.name} />
        </CardContent>
      </Card>
    </div>
  )
}
