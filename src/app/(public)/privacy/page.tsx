import type { Metadata } from "next"
import { loadLegalDoc } from "@/lib/legal"
import { LegalDoc } from "@/components/legal-doc"

export const metadata: Metadata = { title: "Privacy Policy" }
export const dynamic = "force-dynamic"

export default async function PrivacyPage() {
  const blocks = await loadLegalDoc("privacy")
  return <LegalDoc blocks={blocks} />
}
