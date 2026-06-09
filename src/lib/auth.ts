import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { magicLink } from "better-auth/plugins"
import { db } from "@/lib/db/client"
import * as schema from "@/lib/db/schema"
import { Resend } from "resend"

if (!process.env.BETTER_AUTH_SECRET) {
  throw new Error("BETTER_AUTH_SECRET is required")
}
if (!process.env.BETTER_AUTH_URL) {
  throw new Error("BETTER_AUTH_URL is required")
}

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  socialProviders: {
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          },
        }
      : {}),
  },
  user: {
    additionalFields: {
      platformRole: {
        type: "string",
        required: false,
        input: false,
      },
    },
  },
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        if (!resend) {
          // Dev fallback: log to console when Resend not configured
          console.log(`[magic-link] ${email} → ${url}`)
          return
        }
        await resend.emails.send({
          from: process.env.EMAIL_FROM ?? "noreply@localhost",
          to: email,
          subject: "Sign in to your account",
          html: `<p>Click <a href="${encodeURI(url)}">here</a> to sign in. Link expires in 10 minutes.</p>`,
        })
      },
    }),
  ],
})

export type Session = typeof auth.$Infer.Session
export type User = typeof auth.$Infer.Session.user
