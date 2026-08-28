import { useState } from "react";
import { api } from "../api";
import {
  PageTitle,
  Card,
  ErrorNote,
  useApi,
  btnGhost,
  input,
  money,
} from "../App";

interface AppointmentRow {
  id: string;
  startsAt: string;
  endsAt: string;
  status: string;
  notes: string | null;
  customer: { name: string; email: string; phone: string | null };
  service: { name: string; durationMin: number; priceCents: number };
  staff: { name: string };
}

const STATUS_COLORS: Record<string, string> = {
  CONFIRMED: "text-green-700",
  COMPLETED: "text-gray-500",
  CANCELLED: "text-red-600",
  NO_SHOW: "text-amber-600",
};

export default function Appointments() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const { data, loading, error, reload } = useApi<{ appointments: AppointmentRow[] }>(
    `/admin/appointments?date=${date}`,
    [date],
  );

  async function setStatus(id: string, status: string) {
    await api(`/admin/appointments/${id}`, { method: "PATCH", json: { status } });
    reload();
  }

  return (
    <>
      <PageTitle
        title="Appointments"
        action={
          <input
            className={`${input} w-44`}
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        }
      />
      <ErrorNote message={error?.message} />
      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (data?.appointments ?? []).length === 0 ? (
        <Card>
          <p className="py-6 text-center text-sm text-gray-500">No appointments on this day.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {(data?.appointments ?? []).map((a) => (
            <Card key={a.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-gray-900">
                    {new Date(a.startsAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} ·{" "}
                    {a.service.name} · {a.staff.name}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {a.customer.name}
                    {a.customer.phone ? ` · ${a.customer.phone}` : ` · ${a.customer.email}`} ·{" "}
                    {money(a.service.priceCents)} ·{" "}
                    <span className={`font-medium ${STATUS_COLORS[a.status] ?? ""}`}>{a.status}</span>
                  </p>
                </div>
                <div className="flex gap-1.5">
                  {a.status === "CONFIRMED" && (
                    <>
                      <button className={btnGhost} onClick={() => setStatus(a.id, "COMPLETED")}>
                        Complete
                      </button>
                      <button className={btnGhost} onClick={() => setStatus(a.id, "NO_SHOW")}>
                        No-show
                      </button>
                      <button className={btnGhost} onClick={() => setStatus(a.id, "CANCELLED")}>
                        Cancel
                      </button>
                    </>
                  )}
                  {a.status === "PENDING" && (
                    <button className={btnGhost} onClick={() => setStatus(a.id, "CONFIRMED")}>
                      Confirm
                    </button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
