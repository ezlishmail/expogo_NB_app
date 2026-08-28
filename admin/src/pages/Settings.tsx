import { useState } from "react";
import { api } from "../api";
import {
  PageTitle,
  Card,
  Field,
  ErrorNote,
  useApi,
  btn,
  input,
} from "../App";

interface TenantConfig {
  tenant: {
    slug: string;
    name: string;
    brand: Record<string, unknown>;
    features: Record<string, unknown>;
    settings: Record<string, unknown>;
  };
}

const FEATURE_LABELS: Array<[string, string]> = [
  ["appointments", "Appointments"],
  ["shopping", "Shopping"],
  ["delivery", "Delivery"],
  ["pickup", "Store pickup"],
  ["coupons", "Coupons"],
];

const num = (v: unknown, d = 0): number => (typeof v === "number" ? v : d);
const str = (v: unknown, d = ""): string => (typeof v === "string" ? v : v === null || v === undefined ? d : String(v));

const DAY_KEYS: Array<[string, string]> = [
  ["mon", "Mon"], ["tue", "Tue"], ["wed", "Wed"], ["thu", "Thu"], ["fri", "Fri"], ["sat", "Sat"], ["sun", "Sun"],
];
// Opening hours are stored as { mon: "10:30-20:00", … }; a missing day = closed.
const parseRange = (v: unknown): [string, string] | null => {
  if (typeof v !== "string" || !v.includes("-")) return null;
  const [a, b] = v.split("-");
  return [a ?? "", b ?? ""];
};

export default function Settings() {
  const { data, loading, reload } = useApi<TenantConfig>("/config");
  const [form, setForm] = useState<Record<string, unknown> | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading) return <p className="text-sm text-gray-500">Loading…</p>;
  if (!data?.tenant) return <ErrorNote message="Config unavailable" />;

  // Local edit state is seeded from the fetched config on first load.
  const current: Record<string, unknown> = form ?? {
    name: data.tenant.name,
    ...data.tenant.settings,
  };

  function set(key: string, value: unknown) {
    setForm({ ...current, [key]: value });
    setSaved(false);
  }

  const hours: Record<string, string> =
    current.openingHours && typeof current.openingHours === "object"
      ? (current.openingHours as Record<string, string>)
      : {};
  function setDayOpen(key: string, on: boolean) {
    const next = { ...hours };
    if (on) next[key] = parseRange(next[key]) ? next[key] : "10:30-20:00";
    else delete next[key];
    set("openingHours", next);
  }
  function setDayTime(key: string, idx: 0 | 1, value: string) {
    const cur = parseRange(hours[key]) ?? ["10:30", "20:00"];
    cur[idx] = value;
    set("openingHours", { ...hours, [key]: `${cur[0]}-${cur[1]}` });
  }

  async function save() {
    setError(null);
    try {
      const settingsKeys = [
        "currency", "timezone", "deliveryFeeCents", "freeDeliveryOverCents",
        "pickupEnabled", "address", "phone", "reminderHours", "minCancelNoticeMin", "maxAdvanceDays",
        "openingHours", "codEnabled", "codChargeCents",
      ];
      const patch: {
        name: string;
        settings: Record<string, unknown>;
        features: Record<string, unknown>;
      } = { name: current.name as string, settings: {}, features: {} };
      for (const k of Object.keys(current)) {
        if (k === "name") continue;
        if (settingsKeys.includes(k)) patch.settings[k] = current[k];
      }
      await api("/admin/config", { method: "PATCH", json: patch });
      setSaved(true);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function toggleFeature(key: string, enabled: boolean) {
    await api("/admin/config", { method: "PATCH", json: { features: { [key]: enabled } } });
    reload();
  }

  return (
    <>
      <PageTitle
        title="Business settings"
        action={
          <div className="flex items-center gap-3">
            {saved && <span className="text-xs text-green-700">Saved</span>}
            <button className={btn} onClick={save} disabled={form === null}>
              Save changes
            </button>
          </div>
        }
      />
      <ErrorNote message={error} />

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-sm font-semibold text-gray-900">Business</h2>
          <Field label="Name">
            <input className={input} value={str(current.name)} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <Field label="Phone">
            <input className={input} value={str(current.phone)} onChange={(e) => set("phone", e.target.value)} />
          </Field>
          <Field label="Address">
            <input className={input} value={str(current.address)} onChange={(e) => set("address", e.target.value)} />
          </Field>
          <Field label="Timezone (IANA)">
            <input className={input} value={str(current.timezone, "Asia/Kolkata")} onChange={(e) => set("timezone", e.target.value)} />
          </Field>
        </Card>

        <Card>
          <h2 className="mb-4 text-sm font-semibold text-gray-900">Delivery & booking rules</h2>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Delivery fee (₹)">
              <input
                className={input}
                type="number"
                step="0.01"
                min="0"
                value={(num(current.deliveryFeeCents) / 100).toFixed(2)}
                onChange={(e) => set("deliveryFeeCents", Math.round(parseFloat(e.target.value || "0") * 100))}
              />
            </Field>
            <Field label="Free delivery over (₹)">
              <input
                className={input}
                type="number"
                step="0.01"
                min="0"
                value={(num(current.freeDeliveryOverCents) / 100).toFixed(2)}
                onChange={(e) => set("freeDeliveryOverCents", Math.round(parseFloat(e.target.value || "0") * 100))}
              />
            </Field>
            <Field label="Reminder hours before">
              <input
                className={input}
                value={(Array.isArray(current.reminderHours) ? (current.reminderHours as number[]) : [24, 2]).join(", ")}
                onChange={(e) =>
                  set(
                    "reminderHours",
                    e.target.value.split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => !Number.isNaN(n)),
                  )
                }
              />
            </Field>
            <Field label="Min cancel notice (min)">
              <input
                className={input}
                type="number"
                min="0"
                value={num(current.minCancelNoticeMin, 120)}
                onChange={(e) => set("minCancelNoticeMin", Number(e.target.value))}
              />
            </Field>
          </div>
          <h2 className="mb-2 mt-4 text-sm font-semibold text-gray-900">Features</h2>
          <div className="space-y-1.5">
            {FEATURE_LABELS.map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={data.tenant.features[key] !== false}
                  onChange={(e) => toggleFeature(key, e.target.checked)}
                />
                {label}
              </label>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-sm font-semibold text-gray-900">Payments</h2>
          <label className="mb-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={current.codEnabled !== false}
              onChange={(e) => set("codEnabled", e.target.checked)}
            />
            Cash on delivery / pay at counter
          </label>
          <Field label="COD / handling charge (₹)">
            <input
              className={input}
              type="number"
              step="0.01"
              min="0"
              value={(num(current.codChargeCents) / 100).toFixed(2)}
              onChange={(e) => set("codChargeCents", Math.round(parseFloat(e.target.value || "0") * 100))}
            />
          </Field>
          <p className="mb-4 text-xs text-gray-500">Added to every order total. Set ₹0 for no surcharge.</p>
          <label className="flex items-center gap-2 text-sm text-gray-400">
            <input type="checkbox" disabled checked={false} readOnly />
            Online payments (card / UPI)
          </label>
          <p className="mt-1 text-xs text-gray-400">
            Coming soon — the online gateway isn't wired yet. Version 1 is cash only.
          </p>
        </Card>

        <Card>
          <h2 className="mb-1 text-sm font-semibold text-gray-900">Opening hours</h2>
          <p className="mb-3 text-xs text-gray-500">Uncheck a day to mark the salon closed.</p>
          <div className="space-y-1.5">
            {DAY_KEYS.map(([key, label]) => {
              const range = parseRange(hours[key]);
              return (
                <div key={key} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={range !== null} onChange={(e) => setDayOpen(key, e.target.checked)} />
                  <span className="w-10">{label}</span>
                  {range ? (
                    <>
                      <input
                        type="time"
                        className="rounded border border-gray-300 px-1.5 py-1"
                        value={range[0]}
                        onChange={(e) => setDayTime(key, 0, e.target.value)}
                      />
                      –
                      <input
                        type="time"
                        className="rounded border border-gray-300 px-1.5 py-1"
                        value={range[1]}
                        onChange={(e) => setDayTime(key, 1, e.target.value)}
                      />
                    </>
                  ) : (
                    <span className="text-gray-400">Closed</span>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </>
  );
}
