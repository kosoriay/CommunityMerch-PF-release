import type { Metadata } from "next"
import { loadLegalDoc } from "@/lib/legal"
import { LegalDoc } from "@/components/legal-doc"

export const metadata: Metadata = { title: "Help" }
export const dynamic = "force-dynamic"

export default async function HelpPage() {
  const blocks = await loadLegalDoc("help")
  return <LegalDoc blocks={blocks} />
}
