import { useState } from "react";
import { api } from "../api";
import { PageTitle, Card, ErrorNote, useApi, money } from "../App";

interface OrderRow {
  id: string;
  status: string;
  fulfillment: string;
  totalCents: number;
  address: unknown;
  placedAt: string;
  notes: string | null;
  customer: { name: string; email: string };
  items: Array<{ name: string; qty: number; unitPriceCents: number }>;
  payments: Array<{ method: string; status: string }>;
}

const STATUSES = ["PLACED", "CONFIRMED", "READY", "OUT_FOR_DELIVERY", "DELIVERED", "COMPLETED", "CANCELLED"];

export default function Orders() {
  const [statusFilter, setStatusFilter] = useState("PLACED");
  const showAll = statusFilter === "";
  const { data, loading, error, reload } = useApi<{ orders: OrderRow[] }>(
    showAll ? "/admin/orders" : `/admin/orders?status=${statusFilter}`,
    [statusFilter],
  );

  async function patch(id: string, json: Record<string, unknown>) {
    await api(`/admin/orders/${id}`, { method: "PATCH", json });
    reload();
  }

  return (
    <>
      <PageTitle
        title="Orders"
        action={
          <select
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        }
      />
      <ErrorNote message={error?.message} />
      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <div className="space-y-2">
          {(data?.orders ?? []).map((o) => (
            <Card key={o.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900">
                    #{o.id.slice(0, 8)} · {money(o.totalCents)} ·{" "}
                    <span className="text-xs text-gray-500">{o.fulfillment === "DELIVERY" ? "Delivery" : "Pickup"}</span>
                    {" · "}
                    <span className="text-xs text-gray-500">
                      {new Date(o.placedAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {o.customer.name} · {o.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}
                  </p>
                  {o.fulfillment === "DELIVERY" && o.address != null && (
                    <p className="mt-0.5 text-xs text-gray-500">
                      Ship to: {(o.address as { line1?: string; city?: string }).line1}
                      {(o.address as { city?: string }).city ? `, ${(o.address as { city?: string }).city}` : ""}
                    </p>
                  )}
                  <p className="mt-0.5 text-xs text-gray-500">
                    Payment: {o.payments[0]?.method ?? "—"} · {o.payments[0]?.status ?? "—"}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <select
                    className="rounded-lg border border-gray-300 px-2 py-1 text-sm"
                    value={o.status}
                    onChange={(e) => patch(o.id, { status: e.target.value })}
                  >
                    {STATUSES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                  {o.payments[0]?.status !== "PAID" ? (
                    <button
                      className="rounded-lg bg-brand px-2.5 py-1 text-xs font-medium text-white hover:bg-brand/90"
                      onClick={() => patch(o.id, { paymentStatus: "PAID" })}
                    >
                      Mark paid
                    </button>
                  ) : (
                    <button
                      className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50"
                      onClick={() => patch(o.id, { paymentStatus: "REFUNDED" })}
                    >
                      Refund
                    </button>
                  )}
                </div>
              </div>
            </Card>
          ))}
          {!loading && (data?.orders ?? []).length === 0 && (
            <Card>
              <p className="py-6 text-center text-sm text-gray-500">No orders here.</p>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
