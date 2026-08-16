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

/**
 * Support footer for buyer-facing mail. Items ship from an unbranded printing
 * facility, so this — alongside the order page and the packing slip — is how a
 * buyer finds us instead of writing to the printer, who has no relationship
 * with them and cannot help.
 */
function supportHtml(data: {
  orderId: string
  platformName: string
  supportEmail: string | null
}): string {
  const orderRef = data.orderId.slice(0, 8).toUpperCase()
  const contact = data.supportEmail
    ? `email <a href="mailto:${escapeHtml(data.supportEmail)}?subject=Order%20${orderRef}">${escapeHtml(data.supportEmail)}</a>`
    : `contact ${escapeHtml(data.platformName)}`
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  const helpLink = appUrl
    ? ` <a href="${escapeHtml(appUrl)}/help">Common questions</a>.`
    : ""
  return `
    <hr>
    <p><strong>Need help with this order?</strong><br>
    Please ${contact} and quote order <strong>${orderRef}</strong>.
    If an item arrives damaged or misprinted, attach a photo and we'll send a replacement.${helpLink}</p>
    <p style="font-size:12px;color:#666">Please don't ship returns to the address printed on the
    parcel — that facility can't match a package to your order.</p>
  `
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
    platformName: string
    supportEmail: string | null
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
    ${supportHtml(data)}
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
    platformName: string
    supportEmail: string | null
  }
): Promise<void> {
  const html = `
    <h2>Your order has shipped! — ${escapeHtml(data.campaignTitle)}</h2>
    <p>Hi ${escapeHtml(data.buyerName)}, your order is on its way.</p>
    <p><strong>Order:</strong> ${data.orderId.slice(0, 8).toUpperCase()}</p>
    <p><strong>Carrier:</strong> ${escapeHtml(data.carrier)}</p>
    <p><strong>Tracking number:</strong> ${escapeHtml(data.trackingNumber)}</p>
    <p><a href="${escapeHtml(data.trackingUrl)}">Track your package →</a></p>
    ${supportHtml(data)}
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

/**
 * Operator alert: a paid order never reached the print provider.
 *
 * Deliberately blunt about the consequence. This is not an FYI — a buyer has
 * been charged for something that will never ship until someone acts.
 */
export async function sendFulfillmentFailureEmail(
  to: string[],
  data: {
    orderId: string
    campaignTitle: string
    orgName: string
    buyerEmail: string | null
    error: string
    attempts: number
    orderUrl: string | null
    platformName: string
  }
): Promise<void> {
  const orderRef = data.orderId.slice(0, 8).toUpperCase()
  const html = `
    <h2>Order ${orderRef} was paid but not sent to production</h2>
    <p>The buyer has been charged and nothing will ship until this is resolved.</p>
    <p>
      <strong>Campaign:</strong> ${escapeHtml(data.campaignTitle)}<br>
      <strong>Organization:</strong> ${escapeHtml(data.orgName)}<br>
      <strong>Buyer:</strong> ${escapeHtml(data.buyerEmail ?? "unknown")}<br>
      <strong>Attempts:</strong> ${data.attempts}
    </p>
    <p><strong>Error:</strong><br><code>${escapeHtml(data.error)}</code></p>
    ${data.orderUrl ? `<p><a href="${escapeHtml(data.orderUrl)}">Open the order to fix and retry →</a></p>` : ""}
    <p style="font-size:12px;color:#666">If several orders fail at once with an
    authorization error, check whether the Printful API token has expired — they
    last at most two years and expiry stops every order at once.</p>
  `

  if (!resend) {
    console.log(`[email:fulfillment-failure] to=${to.join(",")} order=${data.orderId} error=${data.error}`)
    return
  }

  await resend.emails.send({
    from: FROM,
    to,
    subject: `⚠️ Order ${orderRef} paid but not fulfilled — ${data.platformName}`,
    html,
  })
}

/**
 * Tell the operator that Printful resolved something on their side.
 *
 * Deliberately does not say "refunded" without qualification: Printful
 * refunding the platform owner for a reprint is a different event from the
 * buyer being refunded, and conflating the two would misread the books.
 */
export async function sendPrintfulResolutionEmail(
  to: string[],
  data: {
    orderId: string
    event: "order_refunded" | "package_returned"
    campaignTitle: string
    orgName: string
    printfulOrderId: string | null
    orderUrl: string | null
    platformName: string
  }
): Promise<void> {
  const orderRef = data.orderId.slice(0, 8).toUpperCase()
  const refunded = data.event === "order_refunded"

  const headline = refunded
    ? `Printful refunded order ${orderRef}`
    : `Order ${orderRef} was returned to Printful`
  const explanation = refunded
    ? `Printful has credited the production cost back to you. <strong>The buyer has not been
       refunded by this</strong> — their Stripe payment and the organization's share are
       unchanged. If the buyer is also owed money, refund the order separately.`
    : `The package came back to Printful, usually a bad or refused address. The buyer paid and
       has nothing. Decide whether to correct the address and reship, or refund.`

  const html = `
    <h2>${headline}</h2>
    <p>${explanation}</p>
    <p>
      <strong>Campaign:</strong> ${escapeHtml(data.campaignTitle)}<br>
      <strong>Organization:</strong> ${escapeHtml(data.orgName)}<br>
      <strong>Printful order:</strong> ${escapeHtml(data.printfulOrderId ?? "unknown")}
    </p>
    ${data.orderUrl ? `<p><a href="${escapeHtml(data.orderUrl)}">Open the order →</a></p>` : ""}
  `

  if (!resend) {
    console.log(`[email:printful-resolution] to=${to.join(",")} order=${data.orderId} event=${data.event}`)
    return
  }

  await resend.emails.send({
    from: FROM,
    to,
    subject: `${headline} — ${data.platformName}`,
    html,
  })
}
