import type { LandingTestimonial } from "@/lib/landing-content"

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

export function Testimonials({ items, accentColor }: { items: LandingTestimonial[]; accentColor: string }) {
  if (items.length === 0) return null
  return (
    <section className="w-full max-w-4xl px-4">
      <h2 className="text-2xl font-bold text-center text-gray-900 mb-8">What organizers say</h2>
      <div className="grid gap-6 md:grid-cols-2">
        {items.map((t, i) => (
          <figure key={`${t.name}-${i}`} className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <blockquote className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
              “{t.quote}”
            </blockquote>
            <figcaption className="mt-4 flex items-center gap-3">
              <span
                className="w-9 h-9 rounded-full text-white text-xs font-bold flex items-center justify-center shrink-0"
                style={{ backgroundColor: accentColor }}
              >
                {initials(t.name)}
              </span>
              <span>
                <span className="block text-sm font-semibold text-gray-900">{t.name}</span>
                {t.title ? <span className="block text-xs text-gray-500">{t.title}</span> : null}
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  )
}
