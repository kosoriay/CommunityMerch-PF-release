import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { headers } from "next/headers"
import { getOrCreateConfig, isEnvConfigured } from "@/lib/platform-config"
import { auth } from "@/lib/auth"
import { buttonVariants } from "@/components/ui/button"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  saveStep1Action,
  saveStep2Action,
  advanceServiceStep,
  launchPlatformAction,
} from "./_actions"

type Props = { params: Promise<{ step: string }> }

const SERVICE_STEPS: Record<number, {
  title: string
  description: string
  required: string[]
  optional?: string[]
  docsNote: string
}> = {
  3: {
    title: "Database (Turso)",
    description: "Turso is the database that stores all your platform data.",
    required: ["TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN"],
    docsNote: "See system-design.md → External Service Setup → Turso",
  },
  4: {
    title: "Payments (Stripe)",
    description: "Stripe processes payments and handles bank payouts to organizations.",
    required: [
      "STRIPE_SECRET_KEY",
      "STRIPE_PUBLISHABLE_KEY",
      "STRIPE_WEBHOOK_SECRET",
      "STRIPE_CONNECT_WEBHOOK_SECRET",
    ],
    docsNote: "See system-design.md → External Service Setup → Stripe (two webhook endpoints required)",
  },
  5: {
    title: "Print-on-Demand (Printful)",
    description: "Printful fulfills orders — printing and shipping merchandise to buyers.",
    required: ["PRINTFUL_API_KEY", "PRINTFUL_WEBHOOK_SECRET"],
    docsNote: "See system-design.md → External Service Setup → Printful",
  },
  6: {
    title: "Email (Resend)",
    description: "Resend sends transactional emails — order confirmations and shipping notifications.",
    required: ["RESEND_API_KEY", "EMAIL_FROM"],
    docsNote: "See system-design.md → External Service Setup → Resend",
  },
  7: {
    title: "AI Design (OpenAI)",
    description: "OpenAI powers AI design generation. This step is optional — the platform works without it.",
    required: [],
    optional: ["OPENAI_API_KEY"],
    docsNote: "Optional — skip if you don't need AI design generation",
  },
  8: {
    title: "File Storage (Cloudflare R2)",
    description: "R2 stores uploaded logo and design files.",
    required: [
      "CLOUDFLARE_R2_ACCOUNT_ID",
      "CLOUDFLARE_R2_ACCESS_KEY_ID",
      "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
      "CLOUDFLARE_R2_BUCKET_NAME",
      "CLOUDFLARE_R2_PUBLIC_URL",
    ],
    docsNote: "See system-design.md → External Service Setup → Cloudflare R2",
  },
}

export default async function SetupStepPage({ params }: Props) {
  const { step: stepStr } = await params
  const stepNum = parseInt(stepStr, 10)

  if (isNaN(stepNum) || stepNum < 1 || stepNum > 9) notFound()

  const config = await getOrCreateConfig()

  // Can't access a step higher than current (prevent skipping)
  if (stepNum > config.currentStep) {
    redirect(`/setup/step/${config.currentStep}`)
  }

  // Step 1: Welcome & License Agreement
  if (stepNum === 1) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[#2E4057]">Welcome to Platform Setup</h1>
          <p className="text-muted-foreground mt-2">
            This wizard will guide you through configuring your platform. It takes about 10–15 minutes.
          </p>
        </div>

        <div className="rounded-lg border bg-white p-6 space-y-4">
          <h2 className="font-semibold">Software License Agreement</h2>
          <div className="h-40 overflow-y-auto rounded border p-4 text-sm text-muted-foreground bg-slate-50">
            <p>This software is provided under a proprietary license. By using this platform, you agree to the terms and conditions set by the platform owner. All intellectual property rights remain with the original author. You are granted a non-exclusive, non-transferable license to operate this platform for the purpose described in your license agreement.</p>
            <p className="mt-2">Unauthorized redistribution, resale, or modification of this software without explicit written permission is prohibited.</p>
          </div>

          <form action={saveStep1Action}>
            <div className="flex items-center gap-3 mt-4">
              <input
                type="checkbox"
                id="licenseAgreed"
                name="licenseAgreed"
                required
                defaultChecked={config.licenseAgreed}
                className="h-4 w-4"
              />
              <Label htmlFor="licenseAgreed">
                I have read and agree to the license terms
              </Label>
            </div>
            <Button type="submit" className="mt-4">
              Get Started →
            </Button>
          </form>
        </div>
      </div>
    )
  }

  // Step 2: Brand Identity
  if (stepNum === 2) {
    const isDefaultBrand = config.platformName === "Community Merch Platform"
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[#2E4057]">Brand Identity</h1>
          <p className="text-muted-foreground mt-2">
            Configure your platform&apos;s brand. These values appear throughout the app.
          </p>
        </div>

        {isDefaultBrand && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            💡 まだデフォルト値のままです。リポジトリの <code className="font-mono bg-amber-100 px-1 rounded">.env</code> ファイルに <code className="font-mono bg-amber-100 px-1 rounded">PLATFORM_NAME</code> 等を記載すると、次回から自動で反映されます。このまま下のフォームで入力することもできます。
          </div>
        )}

        <form action={saveStep2Action} className="rounded-lg border bg-white p-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="platformName">Platform name *</Label>
              <Input
                id="platformName"
                name="platformName"
                defaultValue={config.platformName}
                placeholder="Community Merch Platform"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="platformTagline">Tagline</Label>
              <Input
                id="platformTagline"
                name="platformTagline"
                defaultValue={config.platformTagline}
                placeholder="Fundraise with custom merch"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="primaryColor">Primary color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  id="primaryColor"
                  name="primaryColor"
                  defaultValue={config.primaryColor}
                  className="h-9 w-14 rounded border cursor-pointer"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="accentColor">Accent color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  id="accentColor"
                  name="accentColor"
                  defaultValue={config.accentColor}
                  className="h-9 w-14 rounded border cursor-pointer"
                />
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="baseDomain">Domain (optional)</Label>
              <Input
                id="baseDomain"
                name="baseDomain"
                defaultValue={config.baseDomain ?? ""}
                placeholder="yourplatform.com"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="supportEmail">Support email (optional)</Label>
              <Input
                id="supportEmail"
                name="supportEmail"
                type="email"
                defaultValue={config.supportEmail ?? ""}
                placeholder="support@yourplatform.com"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit">Save & Continue →</Button>
            <Link href="/setup/step/1" className={buttonVariants({ variant: "outline" })}>
              ← Back
            </Link>
          </div>
        </form>
      </div>
    )
  }

  // Steps 3–8: Service configuration check
  if (stepNum >= 3 && stepNum <= 8) {
    const svc = SERVICE_STEPS[stepNum]
    const requiredStatus = isEnvConfigured(svc.required)
    const optionalStatus = svc.optional ? isEnvConfigured(svc.optional) : {}
    const allRequiredSet = svc.required.every((k) => requiredStatus[k])
    const boundAction = advanceServiceStep.bind(null, stepNum)

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[#2E4057]">Step {stepNum}: {svc.title}</h1>
          <p className="text-muted-foreground mt-2">{svc.description}</p>
        </div>

        <div className="rounded-lg border bg-white p-6 space-y-4">
          {svc.required.length > 0 && (
            <div>
              <h3 className="font-medium mb-3">Required environment variables</h3>
              <ul className="space-y-2">
                {svc.required.map((key) => (
                  <li key={key} className="flex items-center gap-3 text-sm">
                    <span className={requiredStatus[key] ? "text-green-600" : "text-yellow-600"}>
                      {requiredStatus[key] ? "✓" : "⚠"}
                    </span>
                    <code className="font-mono bg-slate-100 px-2 py-0.5 rounded text-xs">{key}</code>
                    {!requiredStatus[key] && (
                      <span className="text-yellow-600 text-xs">Not set — configure in Vercel environment variables</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {svc.optional && svc.optional.length > 0 && (
            <div>
              <h3 className="font-medium mb-3">Optional environment variables</h3>
              <ul className="space-y-2">
                {svc.optional.map((key) => (
                  <li key={key} className="flex items-center gap-3 text-sm">
                    <span className={optionalStatus[key] ? "text-green-600" : "text-slate-400"}>
                      {optionalStatus[key] ? "✓" : "○"}
                    </span>
                    <code className="font-mono bg-slate-100 px-2 py-0.5 rounded text-xs">{key}</code>
                    {!optionalStatus[key] && (
                      <span className="text-slate-500 text-xs">Optional — skip if not needed</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!allRequiredSet && svc.required.length > 0 && (
            <div className="rounded bg-yellow-50 border border-yellow-200 p-3 text-sm text-yellow-700">
              ⚠ Some required variables are not set. Set them in Vercel and reload this page.
              <br />
              <span className="text-xs text-yellow-600">{svc.docsNote}</span>
            </div>
          )}

          {(allRequiredSet || svc.required.length === 0) && (
            <div className="rounded bg-green-50 border border-green-200 p-3 text-sm text-green-700">
              ✓ {svc.required.length === 0 ? "This step is optional." : "All required variables are configured."}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <form action={boundAction}>
              <Button type="submit">
                Continue →
              </Button>
            </form>
            <Link
              href={`/setup/step/${stepNum - 1}`}
              className={buttonVariants({ variant: "outline" })}
            >
              ← Back
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Step 9: Review & Launch
  if (stepNum === 9) {
    const allServiceKeys = [3, 4, 5, 6, 8].flatMap((s) => SERVICE_STEPS[s].required)
    const allStatus = isEnvConfigured(allServiceKeys)
    const allSet = allServiceKeys.every((k) => allStatus[k])

    const session = await auth.api.getSession({ headers: await headers() })
    const adminEmail = process.env.PLATFORM_ADMIN_EMAIL?.toLowerCase()
    const isSignedIn = !!session?.user.id
    const isAuthorized = !adminEmail || (isSignedIn && session!.user.email.toLowerCase() === adminEmail)

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[#2E4057]">Review & Launch</h1>
          <p className="text-muted-foreground mt-2">
            Review your configuration before launching the platform.
          </p>
        </div>

        <div className="rounded-lg border bg-white p-6 space-y-4">
          <div>
            <h3 className="font-semibold mb-3">Brand Settings</h3>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt className="text-muted-foreground">Platform name</dt>
              <dd className="font-medium">{config.platformName}</dd>
              <dt className="text-muted-foreground">Tagline</dt>
              <dd>{config.platformTagline}</dd>
              <dt className="text-muted-foreground">Primary color</dt>
              <dd className="flex items-center gap-2">
                <span
                  className="inline-block h-4 w-4 rounded border"
                  style={{ backgroundColor: config.primaryColor }}
                />
                {config.primaryColor}
              </dd>
              <dt className="text-muted-foreground">Accent color</dt>
              <dd className="flex items-center gap-2">
                <span
                  className="inline-block h-4 w-4 rounded border"
                  style={{ backgroundColor: config.accentColor }}
                />
                {config.accentColor}
              </dd>
              {config.baseDomain && (
                <>
                  <dt className="text-muted-foreground">Domain</dt>
                  <dd>{config.baseDomain}</dd>
                </>
              )}
            </dl>
          </div>

          <div>
            <h3 className="font-semibold mb-3">Service Configuration</h3>
            {allSet ? (
              <p className="text-sm text-green-700">✓ All required services are configured.</p>
            ) : (
              <p className="text-sm text-yellow-700">
                ⚠ Some services are not fully configured. You can still launch, but some features may not work.
              </p>
            )}
          </div>

          {!isSignedIn && (
            <div className="rounded bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              ⚠ サインインが必要です。<Link href="/sign-in" className="underline font-medium">サインイン</Link>してから再度アクセスしてください。
            </div>
          )}

          {isSignedIn && !isAuthorized && (
            <div className="rounded bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              ⚠ このアカウント（{session!.user.email}）にはセットアップ権限がありません。
              環境変数 <code className="font-mono bg-red-100 px-1 rounded">PLATFORM_ADMIN_EMAIL</code> に設定されたアカウントでサインインしてください。
            </div>
          )}

          <form action={launchPlatformAction} className="pt-2">
            <Button
              type="submit"
              className="w-full text-base py-6"
              disabled={!isAuthorized}
            >
              🚀 Launch Platform
            </Button>
          </form>

          <Link
            href="/setup/step/8"
            className={buttonVariants({ variant: "outline" }) + " w-full text-center block"}
          >
            ← Back to Storage
          </Link>
        </div>
      </div>
    )
  }

  notFound()
}
