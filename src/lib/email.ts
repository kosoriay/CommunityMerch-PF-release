import { Resend } from "resend"

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const FROM = process.env.EMAIL_FROM ?? "noreply@localhost"

function formatCentsForEmail(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

/**
 * Escapes HTML-significant characters so user-supplied values (buyer names,
 * product names, org names, addresses, etc.) can be safely interpolated into
 * email HTML bodies without allowing markup/script injection. Pure — no
 * Resend/network dependency — so it's unit-tested in isolation.
 */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

type OrderItem = {
  name: string
  size: string
  quantity: number
  unitPrice: number
}

export async function sendOrderConfirmationEmail(
  to: string,
  data: {
    orderId: string
    buyerName: string
    campaignTitle: string
    orgName: string
    items: OrderItem[]
    totalAmountCents: number
    shippingAddress: {
      line1?: string
      city?: string
      state?: string
      postal_code?: string
    } | null
  }
): Promise<void> {
  const itemsHtml = data.items
    .map(
      (i) =>
        `<li>${escapeHtml(i.name)} — ${escapeHtml(i.size)} × ${i.quantity}: ${formatCentsForEmail(i.unitPrice * i.quantity)}</li>`
    )
    .join("")

  const shippingHtml = data.shippingAddress
    ? `<p>${escapeHtml(String(data.shippingAddress.line1))}, ${escapeHtml(String(data.shippingAddress.city))}, ${escapeHtml(String(data.shippingAddress.state))} ${escapeHtml(String(data.shippingAddress.postal_code))}</p>`
    : "<p>Address on file</p>"

  const html = `
    <h2>Order Confirmed — ${escapeHtml(data.campaignTitle)}</h2>
    <p>Thank you, ${escapeHtml(data.buyerName)}! Your order from ${escapeHtml(data.orgName)} has been received.</p>
    <p><strong>Order:</strong> ${data.orderId.slice(0, 8).toUpperCase()}</p>
    <ul>${itemsHtml}</ul>
    <p><strong>Total:</strong> ${formatCentsForEmail(data.totalAmountCents)}</p>
    <p><strong>Shipping to:</strong></p>
    ${shippingHtml}
    <p>You'll receive a shipping notification when your order is dispatched.</p>
  `

  if (!resend) {
    console.log(`[email:confirmation] to=${to} order=${data.orderId}`)
    return
  }

  await resend.emails.send({
    from: FROM,
    to,
    subject: `Order confirmed — ${data.campaignTitle}`,
    html,
  })
}

export async function sendShippingNotificationEmail(
  to: string,
  data: {
    orderId: string
    buyerName: string
    campaignTitle: string
    carrier: string
    trackingNumber: string
    trackingUrl: string
  }
): Promise<void> {
  const html = `
    <h2>Your order has shipped! — ${escapeHtml(data.campaignTitle)}</h2>
    <p>Hi ${escapeHtml(data.buyerName)}, your order is on its way.</p>
    <p><strong>Order:</strong> ${data.orderId.slice(0, 8).toUpperCase()}</p>
    <p><strong>Carrier:</strong> ${escapeHtml(data.carrier)}</p>
    <p><strong>Tracking number:</strong> ${escapeHtml(data.trackingNumber)}</p>
    <p><a href="${escapeHtml(data.trackingUrl)}">Track your package →</a></p>
  `

  if (!resend) {
    console.log(`[email:shipping] to=${to} tracking=${data.trackingNumber}`)
    return
  }

  await resend.emails.send({
    from: FROM,
    to,
    subject: `Your order has shipped — ${data.campaignTitle}`,
    html,
  })
}

/**
 * Notifies an org admin that the organization's payout account was
 * replaced. Since the feature keeps no audit-trail columns, this email is
 * the human-facing record of who made the change and when.
 */
export async function sendPayoutAccountReplacedEmail(
  to: string,
  data: {
    orgName: string
    actorName: string
    actorEmail: string
    replacedAt: Date
  }
): Promise<void> {
  const html = `
    <h2>Payout account replaced — ${escapeHtml(data.orgName)}</h2>
    <p>The Stripe payout account for <strong>${escapeHtml(data.orgName)}</strong> was replaced with a new
    connected account by ${escapeHtml(data.actorName)} (${escapeHtml(data.actorEmail)}) on
    ${data.replacedAt.toUTCString()}.</p>
    <p>Payouts and checkout will pause until the new account completes Stripe verification.</p>
    <p>The previous account was not deleted and remains visible in the Stripe dashboard history.</p>
    <p>If you did not expect this change, contact your organization administrators.</p>
  `

  if (!resend) {
    console.log(`[email:payout-account-replaced] to=${to} org=${data.orgName}`)
    return
  }

  await resend.emails.send({
    from: FROM,
    to,
    subject: `Payout account replaced — ${data.orgName}`,
    html,
  })
}
