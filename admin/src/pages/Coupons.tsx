import { useState } from "react";
import { api } from "../api";
import {
  PageTitle,
  Card,
  Modal,
  Field,
  ErrorNote,
  useApi,
  btn,
  btnGhost,
  input,
} from "../App";

interface Coupon {
  id: string;
  code: string;
  kind: "PERCENT" | "FIXED";
  value: number;
  minOrderCents: number;
  expiresAt: string | null;
  maxUses: number | null;
  maxPerUser: number;
  active: boolean;
}

const empty = {
  code: "",
  kind: "PERCENT" as "PERCENT" | "FIXED",
  value: 10,
  minOrderDollars: "0.00",
  expiresAt: "",
  maxUses: "" as string | number,
  maxPerUser: 1,
};

export default function Coupons() {
  const { data, loading, reload } = useApi<{ coupons: Coupon[] }>("/admin/coupons");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    try {
      await api("/admin/coupons", {
        method: "POST",
        json: {
          code: form.code.toUpperCase(),
          kind: form.kind,
          value: form.kind === "PERCENT" ? Number(form.value) : Math.round(parseFloat(String(form.value)) * 100),
          minOrderCents: Math.round(parseFloat(form.minOrderDollars) * 100),
          expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
          maxUses: form.maxUses === "" ? null : Number(form.maxUses),
          maxPerUser: Number(form.maxPerUser),
        },
      });
      setCreating(false);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <>
      <PageTitle
        title="Coupons"
        action={
          <button
            className={btn}
            onClick={() => {
              setForm(empty);
              setCreating(true);
            }}
          >
            + New coupon
          </button>
        }
      />
      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <Card>
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-gray-500">
              <tr>
                <th className="pb-2">Code</th>
                <th className="pb-2">Discount</th>
                <th className="pb-2">Min order</th>
                <th className="pb-2">Expires</th>
                <th className="pb-2">Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(data?.coupons ?? []).map((c) => (
                <tr key={c.id} className={`border-t border-gray-100 ${c.active ? "" : "opacity-50"}`}>
                  <td className="py-2 font-mono font-medium text-gray-900">{c.code}</td>
                  <td>{c.kind === "PERCENT" ? `${c.value}%` : `$${(c.value / 100).toFixed(2)}`}</td>
                  <td>${(c.minOrderCents / 100).toFixed(2)}</td>
                  <td className="text-gray-600">{c.expiresAt ? new Date(c.expiresAt).toLocaleDateString() : "—"}</td>
                  <td>
                    <span className={c.active ? "text-green-700" : "text-gray-400"}>{c.active ? "Active" : "Off"}</span>
                  </td>
                  <td className="py-2 text-right">
                    <button
                      className={btnGhost}
                      onClick={async () => {
                        await api(`/admin/coupons/${c.id}`, { method: "PATCH", json: { active: !c.active } });
                        reload();
                      }}
                    >
                      {c.active ? "Disable" : "Enable"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="New coupon">
        <ErrorNote message={error} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Code">
            <input className={input} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
          </Field>
          <Field label="Type">
            <select className={input} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as any })}>
              <option value="PERCENT">Percent off</option>
              <option value="FIXED">Fixed $ off</option>
            </select>
          </Field>
          <Field label={form.kind === "PERCENT" ? "Percent (%)" : "Amount ($)"}>
            <input
              className={input}
              type="number"
              step={form.kind === "PERCENT" ? "1" : "0.01"}
              min={form.kind === "PERCENT" ? 1 : 0.01}
              max={form.kind === "PERCENT" ? 100 : undefined}
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value as unknown as number })}
            />
          </Field>
          <Field label="Minimum order ($)">
            <input
              className={input}
              type="number"
              step="0.01"
              min="0"
              value={form.minOrderDollars}
              onChange={(e) => setForm({ ...form, minOrderDollars: e.target.value })}
            />
          </Field>
          <Field label="Expires (optional)">
            <input className={input} type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
          </Field>
          <Field label="Total uses (blank = ∞)">
            <input className={input} type="number" min="1" value={form.maxUses} onChange={(e) => setForm({ ...form, maxUses: e.target.value })} />
          </Field>
        </div>
        <Field label="Uses per customer">
          <input className={input} type="number" min="0" value={form.maxPerUser} onChange={(e) => setForm({ ...form, maxPerUser: Number(e.target.value) })} />
        </Field>
        <div className="mt-4 flex justify-end gap-2">
          <button className={btnGhost} onClick={() => setCreating(false)}>
            Cancel
          </button>
          <button className={btn} onClick={save} disabled={!form.code || Number(form.value) <= 0}>
            Create coupon
          </button>
        </div>
      </Modal>
    </>
  );
}
