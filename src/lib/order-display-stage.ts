import { classifyPrintfulStatus } from "@/lib/printful-status"

/**
 * 購入者と団体に見せる段階（設計 2026-09-21 §8）。
 *
 * 購入者には「支払い受領・準備中」までしか見せず、Printful 側の失敗は見せない（D3）。
 * 団体も同じ段階を見る（D4）。管理画面はこれを使わない — 運営者には生の status を見せる。
 */
export type OrderDisplayStage = "processing" | "preparing" | "in_production" | "shipped" | "refunded"

export function orderDisplayStage(status: string, printfulStatus: string | null): OrderDisplayStage {
  switch (status) {
    case "pending":
      return "processing"
    case "paid":
      return "preparing"
    case "fulfilled": {
      const printful = classifyPrintfulStatus(printfulStatus)
      return printful === "in_production" || printful === "done" ? "in_production" : "preparing"
    }
    case "shipped":
    case "delivered":
      return "shipped"
    case "refunded":
      return "refunded"
    default:
      // 未知の status で「発送済み」の嘘をつかない側に倒す
      return "preparing"
  }
}

/** 段階の表示名（英語。UI の言語）。 */
export const ORDER_DISPLAY_STAGE_LABELS: Record<OrderDisplayStage, string> = {
  processing: "Payment processing",
  preparing: "Payment received",
  in_production: "In production",
  shipped: "Shipped",
  refunded: "Refunded",
}
