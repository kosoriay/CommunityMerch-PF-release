import type { Metadata } from "next"
import { loadLegalDoc } from "@/lib/legal"
import { LegalDoc } from "@/components/legal-doc"

export const metadata: Metadata = { title: "Terms of Service" }
export const dynamic = "force-dynamic"

export default async function TermsPage() {
  const blocks = await loadLegalDoc("terms")
  return <LegalDoc blocks={blocks} />
}
