import { drizzle } from "drizzle-orm/libsql"
import { createClient } from "@libsql/client"
import * as schema from "./schema"

if (!process.env.TURSO_DATABASE_URL) {
  throw new Error("TURSO_DATABASE_URL is required")
}
if (
  process.env.TURSO_DATABASE_URL.startsWith("libsql://") &&
  !process.env.TURSO_AUTH_TOKEN
) {
  throw new Error("TURSO_AUTH_TOKEN is required for remote Turso connections")
}

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
})

export const db = drizzle(client, { schema })
export type DB = typeof db
