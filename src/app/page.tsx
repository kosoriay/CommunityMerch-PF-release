import Link from "next/link"
import { redirect } from "next/navigation"
import { getOrCreateConfig } from "@/lib/platform-config"
import { getLandingContent } from "@/lib/landing-content-db"
import { buildStatTiles, getLandingStats } from "@/lib/landing-stats"
import { HowItWorks } from "@/components/landing/how-it-works"
import { StatBand } from "@/components/landing/stat-band"
import { Testimonials } from "@/components/landing/testimonials"
import { Faq } from "@/components/landing/faq"
import { ClosingCta } from "@/components/landing/closing-cta"

// Always render at request time: impact stats and operator content must be
// live, and the setup redirect must reflect the current DB — without this the
// page is prerendered at build time (fresh licensee deploys would bake the
// incomplete-setup redirect and freeze stats at their build-time values).
export const dynamic = "force-dynamic"

export default async function LandingPage() {
  const config = await getOrCreateConfig()

  if (!config.setupComplete) {
    redirect("/setup/step/1")
  }

  const [content, stats] = await Promise.all([getLandingContent(), getLandingStats()])
  const statTiles = buildStatTiles(stats)

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center gap-16 px-4 py-16">
      {/* Hero */}
      <section className="flex flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-3">
          <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-gray-300 flex items-center justify-center bg-white">
            <span className="text-xs text-gray-400 text-center leading-tight px-2">Your Logo Here</span>
          </div>
          <h1 className="text-4xl font-bold" style={{ color: config.primaryColor }}>
            {config.platformName}
          </h1>
          <p className="text-gray-500 text-center max-w-sm">
            {config.platformTagline ?? "Fundraise with custom merch — zero inventory risk."}
          </p>
        </div>

        <div className="text-center max-w-2xl">
          <h2 className="text-3xl font-bold text-gray-900 leading-tight">{content.hero.headline}</h2>
          <p className="mt-3 text-gray-600 leading-relaxed">{content.hero.subtext}</p>
        </div>

        {/* Sample campaign card preview */}
        <div className="grid grid-cols-2 gap-4 opacity-60 pointer-events-none select-none w-full max-w-md">
          {[
            { label: "Unisex T-Shirt", price: "$28", colors: ["#FFFFFF", "#1f2937", "#1e3a5f"] },
            { label: "Kids T-Shirt", price: "$28", colors: ["#FFFFFF", "#dc2626"] },
          ].map((item) => (
            <div key={item.label} className="border border-gray-200 rounded-xl bg-white overflow-hidden shadow-sm">
              <div className="h-36 bg-gray-100 flex items-center justify-center text-6xl">👕</div>
              <div className="p-3">
                <p className="text-sm font-semibold text-gray-800">{item.label}</p>
                <div className="flex gap-1.5 mt-1.5">
                  {item.colors.map((hex) => (
                    <span
                      key={hex}
                      className="w-4 h-4 rounded-full border border-gray-200 inline-block"
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                </div>
                <p className="text-sm font-bold text-gray-900 mt-1">{item.price}</p>
              </div>
            </div>
          ))}
        </div>

        <Link
          href="/start"
          className="text-white px-6 py-3 rounded-lg font-medium hover:brightness-110 transition"
          style={{ backgroundColor: config.primaryColor }}
        >
          {content.hero.ctaLabel}
        </Link>
      </section>

      <HowItWorks steps={content.howItWorks} accentColor={config.accentColor} />
      <StatBand tiles={statTiles} primaryColor={config.primaryColor} />
      <Testimonials items={content.testimonials} accentColor={config.accentColor} />
      <Faq items={content.faqs} />
      <ClosingCta ctaLabel={content.hero.ctaLabel} primaryColor={config.primaryColor} />

      <footer className="flex gap-4 text-xs text-gray-400">
        <Link href="/terms" className="underline hover:text-gray-600">Terms of Service</Link>
        <Link href="/privacy" className="underline hover:text-gray-600">Privacy Policy</Link>
      </footer>
    </div>
  )
}
