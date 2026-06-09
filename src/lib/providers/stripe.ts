import Stripe from "stripe"

if (!process.env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY is required")

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export const PLATFORM_FEE_RATE = 0.09 // 9% platform fee

// feeRate is a decimal (0.09 = 9%). Returns cents.
export function calculateApplicationFee(totalCents: number, feeRate = PLATFORM_FEE_RATE): number {
  return Math.round(totalCents * feeRate)
}
