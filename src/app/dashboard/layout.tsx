import { headers } from "next/headers"
import { redirect } from "next/navigation"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { getOrCreateConfig } from "@/lib/platform-config"
import { signOut } from "./_actions"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session) {
    redirect("/sign-in")
  }

  const platformCfg = await getOrCreateConfig()
  if (!platformCfg.setupComplete) {
    redirect("/setup")
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white px-6 py-3 flex items-center justify-between">
        <div className="font-semibold text-[#2E4057]">{platformCfg.platformName}</div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Link href="/dashboard/account" className="hover:text-foreground transition-colors">
            {session.user.name || session.user.email}
          </Link>
          <SignOutButton />
        </div>
      </header>
      <main className="p-6">{children}</main>
    </div>
  )
}

function SignOutButton() {
  return (
    <form action={signOut}>
      <button type="submit" className="text-sm underline hover:text-foreground transition-colors">
        Sign out
      </button>
    </form>
  )
}
