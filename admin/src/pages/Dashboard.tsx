import { Card, PageTitle, useApi, money } from "../App";

interface Stats {
  revenueTodayCents: number;
  ordersToday: number;
  appointmentsToday: number;
  pendingOrders: number;
  lowStockCount: number;
}

export default function Dashboard() {
  const { data, loading } = useApi<Stats>("/admin/stats");

  const cards: Array<{ label: string; value: string; warn?: boolean }> = [
    { label: "Revenue today", value: data ? money(data.revenueTodayCents) : "—" },
    { label: "Orders today", value: data ? String(data.ordersToday) : "—" },
    { label: "Appointments today", value: data ? String(data.appointmentsToday) : "—" },
    { label: "Pending orders", value: data ? String(data.pendingOrders) : "—", warn: (data?.pendingOrders ?? 0) > 0 },
    { label: "Low-stock products", value: data ? String(data.lowStockCount) : "—", warn: (data?.lowStockCount ?? 0) > 0 },
  ];

  return (
    <>
      <PageTitle title="Dashboard" />
      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          {cards.map((c) => (
            <Card key={c.label}>
              <p className="text-xs text-gray-500">{c.label}</p>
              <p className={`mt-1 text-2xl font-semibold ${c.warn ? "text-amber-600" : "text-gray-900"}`}>
                {c.value}
              </p>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
