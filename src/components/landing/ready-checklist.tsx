"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"

// Staggered timings (ms) for: card 1, card 2, card 3, ready badge, fine print
const DELAYS = [150, 650, 1150, 1900, 2300]

const ITEMS: { icon: ReactNode; title: string; description: string }[] = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
        <path d="M14 3v5h5" />
        <path d="M9 13h6M9 17h4" />
      </svg>
    ),
    title: "Your tax ID",
    description: "Organization EIN — or the treasurer's SSN for informal groups",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <path d="M3 10h18M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 18h18M12 3l9 7H3z" />
      </svg>
    ),
    title: "Bank details",
    description: "Routing & account number where profits get deposited",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    ),
    title: "10 minutes",
    description: "A one-time secure setup powered by Stripe",
  },
]

export function ReadyChecklist({ platformName, accentColor }: { platformName: string; accentColor: string }) {
  const ref = useRef<HTMLElement>(null)
  // "hidden" until scrolled into view, then "animate" (or "static" for
  // prefers-reduced-motion, which skips the entrance animation entirely).
  const [phase, setPhase] = useState<"hidden" | "animate" | "static">("hidden")
  const visible = phase !== "hidden"
  const animate = phase !== "static"

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setPhase(reduced ? "static" : "animate")
          observer.disconnect()
        }
      },
      { threshold: reduced ? 0 : 0.35 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const enter = (delayIndex: number, animation: string) => {
    if (!animate) return undefined
    if (!visible) return { className: "opacity-0" }
    return {
      className: `animate-in ${animation} fill-mode-both duration-500`,
      style: { animationDelay: `${DELAYS[delayIndex]}ms` },
    }
  }

  const card1 = enter(0, "fade-in slide-in-from-bottom-4")
  const card2 = enter(1, "fade-in slide-in-from-bottom-4")
  const card3 = enter(2, "fade-in slide-in-from-bottom-4")
  const cards = [card1, card2, card3]
  const badge = enter(3, "fade-in zoom-in-75")
  const fine = enter(4, "fade-in")

  return (
    <section ref={ref} className="w-full max-w-4xl px-4">
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm px-6 py-10 text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">What you&apos;ll need</h2>
        <p className="text-gray-500 text-sm mb-8">
          One person, one time, about 10 minutes — then your whole team can fundraise.
        </p>

        <div className="flex flex-col md:flex-row items-stretch justify-center gap-3">
          {ITEMS.map((item, i) => (
            <div
              key={item.title}
              className={`flex-1 max-w-xs mx-auto md:mx-0 bg-gray-50 border border-gray-200 rounded-xl px-4 py-5 ${cards[i]?.className ?? ""}`}
              style={cards[i]?.style}
            >
              <span
                className="w-13 h-13 rounded-full flex items-center justify-center mx-auto mb-3"
                style={{ backgroundColor: `${accentColor}1a`, color: accentColor }}
              >
                {item.icon}
              </span>
              <h3 className="font-semibold text-gray-900 text-sm mb-1">{item.title}</h3>
              <p className="text-xs text-gray-500 leading-relaxed">{item.description}</p>
            </div>
          ))}
        </div>

        <div
          className={`inline-flex items-center gap-2 mt-8 rounded-full bg-green-50 border border-green-200 text-green-700 font-semibold px-6 py-3 ${badge?.className ?? ""}`}
          style={badge?.style}
        >
          <svg viewBox="0 0 24 24" className="w-6 h-6" aria-hidden>
            <circle cx="12" cy="12" r="11" className="fill-green-600" />
            <path d="M7 12.5l3.5 3.5L17 9" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          You&apos;re ready to {platformName}!
        </div>

        <p className={`mt-4 text-xs text-gray-500 ${fine?.className ?? ""}`} style={fine?.style}>
          Build your campaign first — connect the bank when you&apos;re ready to go live.
        </p>
      </div>
    </section>
  )
}
