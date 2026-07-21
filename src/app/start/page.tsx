import { getCatalog } from "@/lib/catalog-db"
import { PreviewBuilder } from "./_builder"

export const revalidate = 300

export default async function StartPage() {
  const catalog = await getCatalog()
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-[#2E4057]">Build your campaign</h1>
          <p className="text-sm text-muted-foreground">
            Pick your products and colors and name it. No account needed yet — sign up when you&apos;re ready to save.
          </p>
        </div>
        <div className="rounded-lg border bg-white p-6">
          <PreviewBuilder catalog={catalog} />
        </div>
      </div>
    </div>
  )
}
