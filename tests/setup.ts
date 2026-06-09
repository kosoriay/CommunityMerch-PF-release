// Vitest global setup — stub required env vars so DB client module can load
// without a real Turso connection during unit tests.
process.env.TURSO_DATABASE_URL = process.env.TURSO_DATABASE_URL ?? "file:test.db"
process.env.TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN ?? ""
