import { describe, it, expect, vi, afterAll } from "vitest"

// email.ts は import 時に RESEND_API_KEY を見て Resend を作る。送信内容（html）を
// 見るため、キーを入れたうえで Resend をモックする。キーは afterAll で戻す。
const send = vi.hoisted(() => {
  process.env.RESEND_API_KEY = "re_test_fake_for_unit_tests"
  return vi.fn()
})
vi.mock("resend", () => ({
  Resend: class {
    emails = { send }
  },
}))

import { sendPrintfulStatusAlertEmail, sendOrderAnomalyEmail } from "./email"

afterAll(() => { delete process.env.RESEND_API_KEY })

const ITEM = {
  orderId: "a479cf06-750e-44a1-8135-6cdcae8965a0",
  campaignTitle: "Spring Fundraiser",
  orgName: "Lincoln PTA",
  printfulStatus: "failed",
  printfulStatusReason: '<script>alert("x")</script>',
  printfulOrderId: "171452698",
  guidance: "Check the payment method.",
  orderUrl: "https://example.com/admin/orders/a479cf06",
}

describe("sendPrintfulStatusAlertEmail", () => {
  it("escapes the Printful reason — it comes from an unsigned webhook (設計 §5.4)", async () => {
    await sendPrintfulStatusAlertEmail(["op@example.com"], { platformName: "QA", items: [ITEM], notes: [] })
    const html = send.mock.calls.at(-1)![0].html as string
    expect(html).toContain("&lt;script&gt;")
    expect(html).not.toContain("<script>")
  })

  it("puts every order and every note in one message", async () => {
    await sendPrintfulStatusAlertEmail(["op@example.com"], {
      platformName: "QA",
      items: [ITEM, { ...ITEM, orderId: "b479cf06-750e-44a1-8135-6cdcae8965a0", printfulStatusReason: null }],
      notes: ["Printful rejected the status check with an authorization error."],
    })
    const message = send.mock.calls.at(-1)![0]
    expect(message.subject).toContain("2 orders are stopped at Printful")
    expect(message.html).toContain("A479CF06")
    expect(message.html).toContain("B479CF06")
    expect(message.html).toContain("authorization error")
  })
})

describe("sendOrderAnomalyEmail", () => {
  it("escapes what it is given", async () => {
    await sendOrderAnomalyEmail(["op@example.com"], {
      orderId: ITEM.orderId,
      headline: "Printful shipped an order that was already refunded",
      detail: "detail",
      campaignTitle: "<b>Spring</b>",
      orgName: "Lincoln PTA",
      printfulOrderId: null,
      orderUrl: null,
      platformName: "QA",
    })
    const html = send.mock.calls.at(-1)![0].html as string
    expect(html).toContain("&lt;b&gt;Spring&lt;/b&gt;")
  })
})
