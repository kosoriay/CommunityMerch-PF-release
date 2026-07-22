import Link from "next/link"

export function ClosingCta({ ctaLabel, primaryColor }: { ctaLabel: string; primaryColor: string }) {
  return (
    <section className="w-full max-w-2xl px-4 text-center">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Ready to start fundraising?</h2>
      <p className="text-gray-500 mb-6">Build your first campaign in minutes — free, with nothing to stock.</p>
      <Link
        href="/start"
        className="inline-block text-white px-6 py-3 rounded-lg font-medium hover:brightness-110 transition"
        style={{ backgroundColor: primaryColor }}
      >
        {ctaLabel}
      </Link>
    </section>
  )
}
