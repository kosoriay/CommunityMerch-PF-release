import { Resend } from "resend"

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const FROM = process.env.EMAIL_FROM ?? "noreply@localhost"

function formatCentsForEmail(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
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
        `<li>${i.name} — ${i.size} × ${i.quantity}: ${formatCentsForEmail(i.unitPrice * i.quantity)}</li>`
    )
    .join("")

  const shippingHtml = data.shippingAddress
    ? `<p>${data.shippingAddress.line1}, ${data.shippingAddress.city}, ${data.shippingAddress.state} ${data.shippingAddress.postal_code}</p>`
    : "<p>Address on file</p>"

  const html = `
    <h2>Order Confirmed — ${data.campaignTitle}</h2>
    <p>Thank you, ${data.buyerName}! Your order from ${data.orgName} has been received.</p>
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
    <h2>Your order has shipped! — ${data.campaignTitle}</h2>
    <p>Hi ${data.buyerName}, your order is on its way.</p>
    <p><strong>Order:</strong> ${data.orderId.slice(0, 8).toUpperCase()}</p>
    <p><strong>Carrier:</strong> ${data.carrier}</p>
    <p><strong>Tracking number:</strong> ${data.trackingNumber}</p>
    <p><a href="${data.trackingUrl}">Track your package →</a></p>
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
