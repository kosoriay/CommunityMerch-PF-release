import Link from "next/link"
import { redirect } from "next/navigation"
import { getOrCreateConfig } from "@/lib/platform-config"

export default async function LandingPage() {
  const config = await getOrCreateConfig()

  if (!config.setupComplete) {
    redirect("/setup/step/1")
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      {/* Logo placeholder + heading */}
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-gray-300 flex items-center justify-center bg-white">
          <span className="text-xs text-gray-400 text-center leading-tight px-2">Your Logo Here</span>
        </div>
        <h1 className="text-4xl font-bold text-[#2E4057]">{config.platformName}</h1>
        <p className="text-gray-500 text-center max-w-sm">
          {config.platformTagline ?? "Fundraise with custom merch — zero inventory risk."}
        </p>
      </div>

      {/* Sample campaign card preview */}
      <div className="grid grid-cols-2 gap-3 mb-8 opacity-60 pointer-events-none select-none max-w-xs">
        {[
          { label: "Unisex T-Shirt", price: "$28", colors: ["#FFFFFF", "#1f2937", "#1e3a5f"] },
          { label: "Kids T-Shirt", price: "$28", colors: ["#FFFFFF", "#dc2626"] },
        ].map((item) => (
          <div key={item.label} className="border border-gray-200 rounded-xl bg-white overflow-hidden shadow-sm">
            <div className="h-24 bg-gray-100 flex items-center justify-center text-3xl">👕</div>
            <div className="p-2">
              <p className="text-xs font-semibold text-gray-800">{item.label}</p>
              <div className="flex gap-1 mt-1">
                {item.colors.map((hex) => (
                  <span
                    key={hex}
                    className="w-3 h-3 rounded-full border border-gray-200 inline-block"
                    style={{ backgroundColor: hex }}
                  />
                ))}
              </div>
              <p className="text-xs font-bold text-gray-900 mt-1">{item.price}</p>
            </div>
          </div>
        ))}
      </div>

      <Link
        href="/sign-in"
        className="bg-[#2E4057] text-white px-6 py-3 rounded-lg font-medium hover:bg-[#1e2d3d] transition-colors"
      >
        Get Started — Free
      </Link>
    </div>
  )
}
