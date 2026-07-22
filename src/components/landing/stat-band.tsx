import type { StatTile } from "@/lib/landing-stats"

export function StatBand({ tiles, primaryColor }: { tiles: StatTile[]; primaryColor: string }) {
  if (tiles.length === 0) return null
  return (
    <section className="w-full max-w-4xl px-4">
      <div
        className="rounded-2xl px-6 py-8 flex flex-col sm:flex-row justify-center gap-8 text-center"
        style={{ backgroundColor: primaryColor }}
      >
        {tiles.map((t) => (
          <div key={t.label}>
            <p className="text-3xl font-bold text-white">{t.value}</p>
            <p className="text-sm text-white/80 mt-1">{t.label}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
