import { getOrCreateConfig } from "@/lib/platform-config"
import { redirect } from "next/navigation"

const STEP_LABELS = [
  "Welcome",
  "Brand",
  "Database",
  "Payments",
  "Printful",
  "Email",
  "AI Design",
  "Storage",
  "Launch",
]

type Props = { children: React.ReactNode }

export default async function SetupLayout({ children }: Props) {
  const config = await getOrCreateConfig()

  if (config.setupComplete) {
    redirect("/")
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <header className="border-b bg-white px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="font-semibold text-[#2E4057] text-lg">Platform Setup</div>
          <div className="text-sm text-muted-foreground">
            Step {config.currentStep} of {STEP_LABELS.length}
          </div>
        </div>
      </header>

      <div className="border-b bg-white">
        <div className="max-w-3xl mx-auto px-6 py-3">
          <div className="flex gap-1">
            {STEP_LABELS.map((label, i) => {
              const stepNum = i + 1
              const isComplete = stepNum < config.currentStep
              const isCurrent = stepNum === config.currentStep
              return (
                <div
                  key={stepNum}
                  className={`flex-1 h-1.5 rounded-full transition-colors ${
                    isComplete
                      ? "bg-green-500"
                      : isCurrent
                      ? "bg-[#378ADD]"
                      : "bg-slate-100"
                  }`}
                  title={`Step ${stepNum}: ${label}`}
                />
              )
            })}
          </div>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  )
}
