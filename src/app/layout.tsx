import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { getOrCreateConfig } from "@/lib/platform-config"

const inter = Inter({ subsets: ["latin"] })

export async function generateMetadata(): Promise<Metadata> {
  const config = await getOrCreateConfig()
  return {
    title: config.platformName,
    description: config.platformTagline ?? "Fundraise with custom merch — zero inventory risk.",
  }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* iOS Safari PWA support (ignores manifest.json — needs explicit meta tags) */}
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Admin" />
      </head>
      <body className={inter.className}>
        {children}
      </body>
    </html>
  )
}
