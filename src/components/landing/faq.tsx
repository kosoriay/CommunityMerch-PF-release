import { ChevronDown } from "lucide-react"
import type { LandingFaq } from "@/lib/landing-content"

export function Faq({ items }: { items: LandingFaq[] }) {
  if (items.length === 0) return null
  return (
    <section className="w-full max-w-2xl px-4">
      <h2 className="text-2xl font-bold text-center text-gray-900 mb-8">Frequently asked questions</h2>
      <div className="flex flex-col gap-3">
        {items.map((f, i) => (
          <details key={`${f.question}-${i}`} className="group bg-white border border-gray-200 rounded-xl px-5 py-4">
            <summary className="flex items-center justify-between gap-4 cursor-pointer list-none text-sm font-semibold text-gray-900 [&::-webkit-details-marker]:hidden">
              {f.question}
              <ChevronDown size={16} className="shrink-0 text-gray-400 transition-transform group-open:rotate-180" />
            </summary>
            <p className="mt-3 text-sm text-gray-600 leading-relaxed whitespace-pre-line">{f.answer}</p>
          </details>
        ))}
      </div>
    </section>
  )
}
