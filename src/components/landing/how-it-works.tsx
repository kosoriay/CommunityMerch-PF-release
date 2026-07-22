import type { LandingStep } from "@/lib/landing-content"

export function HowItWorks({ steps, accentColor }: { steps: LandingStep[]; accentColor: string }) {
  return (
    <section className="w-full max-w-4xl px-4">
      <h2 className="text-2xl font-bold text-center text-gray-900 mb-8">How it works</h2>
      <ol className="grid gap-6 md:grid-cols-3">
        {steps.map((step, i) => (
          <li key={step.title} className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <span
              className="w-8 h-8 rounded-full text-white text-sm font-bold flex items-center justify-center mb-4"
              style={{ backgroundColor: accentColor }}
            >
              {i + 1}
            </span>
            <h3 className="font-semibold text-gray-900 mb-2">{step.title}</h3>
            <p className="text-sm text-gray-600 leading-relaxed">{step.description}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}
