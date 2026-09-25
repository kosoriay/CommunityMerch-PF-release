import { describe, it, expect } from "vitest"
import {
  classifyPrintfulStatus,
  shouldAlertPrintfulStatus,
  reasonForObservation,
  truncatePrintfulText,
  printfulFixGuidance,
  printfulUncheckedGuidance,
  PRINTFUL_HEALTHY_STATUSES,
  PRINTFUL_NOT_FOUND,
  PRINTFUL_TEXT_MAX_LENGTH,
} from "./printful-status"

// Printful v1 の Order.status に現れる値（設計 §1.2 P1）。enum 定義は無い。
const P1 = ["draft", "inreview", "pending", "failed", "canceled", "inprocess", "onhold", "partial", "fulfilled", "archived"]

describe("classifyPrintfulStatus", () => {
  it.each([
    [null, "unknown"],
    ["pending", "progressing"],
    ["inreview", "progressing"],
    ["inprocess", "in_production"],
    ["partial", "in_production"],
    ["fulfilled", "done"],
    ["archived", "done"],
    ["failed", "needs_action"],
    ["onhold", "needs_action"],
    ["canceled", "needs_action"],
    ["draft", "needs_action"],
    [PRINTFUL_NOT_FOUND, "needs_action"],
  ] as const)("%s → %s", (status, expected) => {
    expect(classifyPrintfulStatus(status)).toBe(expected)
  })

  it("puts a status Printful has never documented on the needs-action side (fail-closed)", () => {
    expect(classifyPrintfulStatus("some_future_status")).toBe("needs_action")
  })

  it("agrees with PRINTFUL_HEALTHY_STATUSES for every P1 value — the SQL uses that list", () => {
    for (const status of P1) {
      const healthy = (PRINTFUL_HEALTHY_STATUSES as readonly string[]).includes(status)
      expect({ status, needsAction: classifyPrintfulStatus(status) === "needs_action" })
        .toEqual({ status, needsAction: !healthy })
    }
  })
})

describe("shouldAlertPrintfulStatus", () => {
  it("alerts on draft only when orders are auto-confirmed", () => {
    expect(shouldAlertPrintfulStatus("draft", true)).toBe(true)
    expect(shouldAlertPrintfulStatus("draft", false)).toBe(false)
  })

  it.each(["failed", "onhold", "canceled", PRINTFUL_NOT_FOUND, "some_future_status"])(
    "alerts on %s in both modes",
    (status) => {
      expect(shouldAlertPrintfulStatus(status, true)).toBe(true)
      expect(shouldAlertPrintfulStatus(status, false)).toBe(true)
    }
  )

  it.each([null, ...PRINTFUL_HEALTHY_STATUSES])("does not alert on %s", (status) => {
    expect(shouldAlertPrintfulStatus(status, true)).toBe(false)
    expect(shouldAlertPrintfulStatus(status, false)).toBe(false)
  })
})

describe("reasonForObservation", () => {
  it.each([
    ["order_failed", "failed"],
    ["order_canceled", "canceled"],
    ["order_put_hold", "onhold"],
    ["order_put_hold_approval", "onhold"],
  ])("keeps the reason when %s matches the re-fetched status %s", (event, status) => {
    expect(reasonForObservation(event, status, "Card declined")).toBe("Card declined")
  })

  it("drops the reason when the re-fetched status disagrees with the event", () => {
    expect(reasonForObservation("order_failed", "inprocess", "Card declined")).toBeNull()
  })

  it.each(["order_updated", "order_remove_hold"])("never takes a reason from %s", (event) => {
    expect(reasonForObservation(event, "onhold", "anything")).toBeNull()
  })

  it("drops a reason that is not a non-empty string", () => {
    expect(reasonForObservation("order_failed", "failed", 42)).toBeNull()
    expect(reasonForObservation("order_failed", "failed", "  ")).toBeNull()
  })
})

describe("truncatePrintfulText", () => {
  it("keeps a text of exactly the limit", () => {
    const text = "x".repeat(PRINTFUL_TEXT_MAX_LENGTH)
    expect(truncatePrintfulText(text)).toBe(text)
  })

  it("cuts one over the limit down to the limit", () => {
    expect(truncatePrintfulText("x".repeat(PRINTFUL_TEXT_MAX_LENGTH + 1))).toHaveLength(PRINTFUL_TEXT_MAX_LENGTH)
  })
})

describe("printfulFixGuidance", () => {
  it("tells the operator to add a payment method for a failed order", () => {
    expect(printfulFixGuidance("failed")).toMatch(/payment method/i)
  })

  it("says to cancel in Printful before refunding an order that would still be printed", () => {
    for (const status of ["failed", "onhold", "draft"]) {
      expect(printfulFixGuidance(status)).toMatch(/cancel the order in Printful first/)
    }
  })

  it("has a fallback for a status it does not know", () => {
    expect(printfulFixGuidance("some_future_status")).toMatch(/does not recognise/)
  })
})

describe("printfulUncheckedGuidance", () => {
  it("quotes the check error when a check failed (C2 a)", () => {
    expect(printfulUncheckedGuidance("order_failed: HTTP 503")).toContain("order_failed: HTTP 503")
  })

  it("points at the daily check when nothing failed but nothing was checked (C2 b)", () => {
    expect(printfulUncheckedGuidance(null)).toMatch(/daily check/)
  })
})
