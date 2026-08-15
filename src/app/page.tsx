import Link from "next/link"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { getOrCreateConfig } from "@/lib/platform-config"
import { getCatalog, type CatalogItem } from "@/lib/catalog-db"
import { suggestedRetailCents } from "@/lib/printful-catalog"
import { formatCents } from "@/lib/format"
import { getLandingContent } from "@/lib/landing-content-db"
import { buildStatTiles, getLandingStats } from "@/lib/landing-stats"
import { HowItWorks } from "@/components/landing/how-it-works"
import { ReadyChecklist } from "@/components/landing/ready-checklist"
import { StatBand } from "@/components/landing/stat-band"
import { Testimonials } from "@/components/landing/testimonials"
import { Faq } from "@/components/landing/faq"
import { ClosingCta } from "@/components/landing/closing-cta"

// Always render at request time: impact stats and operator content must be
// live, and the setup redirect must reflect the current DB — without this the
// page is prerendered at build time (fresh licensee deploys would bake the
// incomplete-setup redirect and freeze stats at their build-time values).
export const dynamic = "force-dynamic"

// Spread four picks across the catalog's display order so the preview shows
// product variety (tees at the start, hoodies mid-list, mugs/totes at the
// end) instead of four near-identical shirts.
function pickSampleProducts(catalog: CatalogItem[]): CatalogItem[] {
  if (catalog.length <= 4) return catalog
  const last = catalog.length - 1
  const indexes = [...new Set([0, Math.round(last / 3), Math.round((2 * last) / 3), last])]
  return indexes.map((i) => catalog[i])
}

export default async function LandingPage() {
  const config = await getOrCreateConfig()

  if (!config.setupComplete) {
    redirect("/setup/step/1")
  }

  const [content, stats, session, catalog] = await Promise.all([
    getLandingContent(),
    getLandingStats(),
    auth.api.getSession({ headers: await headers() }),
    getCatalog(),
  ])
  const statTiles = buildStatTiles(stats)
  const sampleProducts = pickSampleProducts(catalog)

  return (
    <div className="relative min-h-screen bg-gray-50 flex flex-col items-center gap-16 px-4 py-16">
      {/* Returning-user entry point */}
      <nav className="absolute top-5 right-5">
        {session ? (
          <Link
            href="/dashboard"
            className="text-sm font-medium text-white px-4 py-2 rounded-lg hover:brightness-110 transition"
            style={{ backgroundColor: config.primaryColor }}
          >
            Dashboard →
          </Link>
        ) : (
          <Link
            href="/sign-in"
            className="text-sm font-medium text-gray-600 hover:text-gray-900 px-4 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-100 transition"
          >
            Sign in
          </Link>
        )}
      </nav>
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

        {/* Sample product preview from the real catalog (tees, hoodies, mugs, …) */}
        {sampleProducts.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 opacity-70 pointer-events-none select-none w-full max-w-2xl">
            {sampleProducts.map((item) => (
              <div key={item.id} className="border border-gray-200 rounded-xl bg-white overflow-hidden shadow-sm">
                <div className="h-32 bg-gray-100 flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.catalogImageUrl}
                    alt={item.name}
                    className="h-full w-full object-contain p-2"
                  />
                </div>
                <div className="p-3">
                  <p className="text-xs font-semibold text-gray-800 truncate">{item.name}</p>
                  <div className="flex gap-1.5 mt-1.5">
                    {item.availableColors.slice(0, 4).map((color) => (
                      <span
                        key={color.hex}
                        className="w-3.5 h-3.5 rounded-full border border-gray-200 inline-block"
                        style={{ backgroundColor: color.hex }}
                      />
                    ))}
                  </div>
                  <p className="text-sm font-bold text-gray-900 mt-1">
                    {formatCents(suggestedRetailCents(item.podCostCents))}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        <Link
          href="/start"
          className="text-white px-6 py-3 rounded-lg font-medium hover:brightness-110 transition"
          style={{ backgroundColor: config.primaryColor }}
        >
          {content.hero.ctaLabel}
        </Link>
      </section>

      <HowItWorks steps={content.howItWorks} accentColor={config.accentColor} />
      <ReadyChecklist platformName={config.platformName} accentColor={config.accentColor} />
      <StatBand tiles={statTiles} primaryColor={config.primaryColor} />
      <Testimonials items={content.testimonials} accentColor={config.accentColor} />
      <Faq items={content.faqs} />
      <ClosingCta ctaLabel={content.hero.ctaLabel} primaryColor={config.primaryColor} />

      <footer className="flex gap-4 text-xs text-gray-400">
        <Link href="/help" className="underline hover:text-gray-600">Help</Link>
        <Link href="/terms" className="underline hover:text-gray-600">Terms of Service</Link>
        <Link href="/privacy" className="underline hover:text-gray-600">Privacy Policy</Link>
      </footer>
    </div>
  )
}
