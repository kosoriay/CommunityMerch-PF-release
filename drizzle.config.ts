import { defineConfig } from "drizzle-kit"
import { loadEnvConfig } from "@next/env"

// drizzle-kit does not read .env.local on its own, so `db:init` saw
// `url: undefined` locally. Same loader as scripts/seed-catalog.ts.
// Load order is .env.local then .env; variables already in process.env win,
// so this is a no-op on Vercel where the environment is already populated.
loadEnvConfig(process.cwd())

// WARNING: `db:init` runs `drizzle-kit push --force`, which can destroy data in
// whatever database this URL points at. Now that .env.local is loaded, that may
// be a real database. Read the host line below before letting a push proceed.
// Only the host is printed: never the token, never the full URL.
function describeTargetHost(rawUrl: string | undefined): string {
  if (!rawUrl) return "[drizzle] TURSO_DATABASE_URL is not set (no target database)"
  try {
    return `[drizzle] target database host: ${new URL(rawUrl).host}`
  } catch {
    return "[drizzle] TURSO_DATABASE_URL is set but not a parseable URL"
  }
}
console.error(describeTargetHost(process.env.TURSO_DATABASE_URL))

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "turso",
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
})
