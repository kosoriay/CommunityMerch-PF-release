const STATUS_STYLES: Record<string, string> = {
  pending: "bg-slate-100 text-slate-700",
  paid: "bg-blue-100 text-blue-700",
  fulfilled: "bg-indigo-100 text-indigo-700",
  shipped: "bg-amber-100 text-amber-700",
  delivered: "bg-green-100 text-green-700",
  refunded: "bg-red-100 text-red-700",
}

export function OrderStatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? "bg-slate-100 text-slate-700"
  return (
    <span className={`px-2 py-0.5 rounded capitalize ${style}`}>{status}</span>
  )
}
