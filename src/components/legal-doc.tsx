import Link from "next/link"
import type { LegalBlock } from "@/lib/legal"

export function LegalDoc({ blocks }: { blocks: LegalBlock[] }) {
  return (
    <div className="min-h-screen bg-white">
      <article className="mx-auto max-w-3xl px-4 py-12 space-y-4">
        {blocks.map((block, i) => {
          if (block.type === "h1") {
            return (
              <h1 key={i} className="text-3xl font-bold text-gray-900">
                {block.text}
              </h1>
            )
          }
          if (block.type === "h2") {
            return (
              <h2 key={i} className="text-xl font-semibold text-gray-900 pt-6">
                {block.text}
              </h2>
            )
          }
          if (block.type === "h3") {
            return (
              <h3 key={i} className="text-lg font-semibold text-gray-900 pt-4">
                {block.text}
              </h3>
            )
          }
          if (block.type === "ul") {
            return (
              <ul key={i} className="list-disc pl-6 space-y-1 text-gray-700 leading-relaxed">
                {block.items.map((item, j) => (
                  <li key={j}>{item}</li>
                ))}
              </ul>
            )
          }
          return (
            <p key={i} className="text-gray-700 leading-relaxed">
              {block.text}
            </p>
          )
        })}
        <footer className="pt-10 flex gap-4 text-sm text-gray-500">
          <Link href="/" className="underline hover:text-gray-700">Home</Link>
          <Link href="/terms" className="underline hover:text-gray-700">Terms of Service</Link>
          <Link href="/privacy" className="underline hover:text-gray-700">Privacy Policy</Link>
        </footer>
      </article>
    </div>
  )
}
