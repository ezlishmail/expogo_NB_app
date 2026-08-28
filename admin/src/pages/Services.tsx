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
  money,
} from "../App";

interface Service {
  id: string;
  name: string;
  description: string | null;
  durationMin: number;
  priceCents: number;
  active: boolean;
  category: string | null;
  forGender: "MALE" | "FEMALE" | null;
}

const empty = { name: "", description: "", durationMin: 30, priceRupees: "0.00", category: "", forGender: "" };

export default function Services() {
  const { data, loading, reload } = useApi<{ services: Service[] }>("/admin/services");
  const [editing, setEditing] = useState<Service | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState<string | null>(null);
  const categoryOptions = [
    ...new Set((data?.services ?? []).map((s) => s.category).filter((c): c is string => !!c)),
  ].sort();

  function openCreate() {
    setForm(empty);
    setError(null);
    setCreating(true);
  }
  function openEdit(s: Service) {
    setForm({
      name: s.name,
      description: s.description ?? "",
      durationMin: s.durationMin,
      priceRupees: (s.priceCents / 100).toFixed(2),
      category: s.category ?? "",
      forGender: s.forGender ?? "",
    });
    setError(null);
    setEditing(s);
  }

  async function save() {
    try {
      const body = {
        name: form.name,
        description: form.description || null,
        durationMin: Number(form.durationMin),
        priceCents: Math.round(parseFloat(form.priceRupees) * 100),
        category: form.category.trim() || null,
        forGender: form.forGender || null,
      };
      if (editing) await api(`/admin/services/${editing.id}`, { method: "PATCH", json: body });
      else await api("/admin/services", { method: "POST", json: body });
      setEditing(null);
      setCreating(false);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function toggleActive(s: Service) {
    await api(`/admin/services/${s.id}`, { method: "PATCH", json: { active: !s.active } });
    reload();
  }

  return (
    <>
      <PageTitle
        title="Services"
        action={
          <button className={btn} onClick={openCreate}>
            + New service
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
                <th className="pb-2">Name</th>
                <th className="pb-2">Category</th>
                <th className="pb-2">Duration</th>
                <th className="pb-2">Price</th>
                <th className="pb-2">Status</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {(data?.services ?? []).map((s) => (
                <tr key={s.id} className="border-t border-gray-100">
                  <td className="py-2 font-medium text-gray-900">
                    {s.name}
                    {s.description && <p className="text-xs font-normal text-gray-500">{s.description}</p>}
                  </td>
                  <td className="text-gray-600">
                    {s.category ?? "—"}
                    {s.forGender && (
                      <span className="ml-1.5 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] uppercase text-gray-500">
                        {s.forGender === "MALE" ? "Gents" : "Ladies"}
                      </span>
                    )}
                  </td>
                  <td>{s.durationMin} min</td>
                  <td>{s.priceCents === 0 ? "Free" : money(s.priceCents)}</td>
                  <td>
                    <span className={s.active ? "text-green-700" : "text-gray-400"}>
                      {s.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="py-2 text-right">
                    <button className={btnGhost} onClick={() => openEdit(s)}>
                      Edit
                    </button>{" "}
                    <button className={btnGhost} onClick={() => toggleActive(s)}>
                      {s.active ? "Disable" : "Enable"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Modal
        open={creating || editing !== null}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        title={editing ? "Edit service" : "New service"}
      >
        <ErrorNote message={error} />
        <Field label="Name">
          <input className={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Description">
          <textarea
            className={input}
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <input
              className={input}
              list="service-categories"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              placeholder="e.g. Hair Cut"
            />
            <datalist id="service-categories">
              {categoryOptions.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
          <Field label="For clientele">
            <select
              className={input}
              value={form.forGender}
              onChange={(e) => setForm({ ...form, forGender: e.target.value })}
            >
              <option value="">Everyone</option>
              <option value="MALE">Gents only</option>
              <option value="FEMALE">Ladies only</option>
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Duration (minutes)">
            <input
              className={input}
              type="number"
              min={5}
              max={600}
              value={form.durationMin}
              onChange={(e) => setForm({ ...form, durationMin: Number(e.target.value) })}
            />
          </Field>
          <Field label="Price (₹)">
            <input
              className={input}
              type="number"
              step="0.01"
              min="0"
              value={form.priceRupees}
              onChange={(e) => setForm({ ...form, priceRupees: e.target.value })}
            />
          </Field>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            className={btnGhost}
            onClick={() => {
              setCreating(false);
              setEditing(null);
            }}
          >
            Cancel
          </button>
          <button className={btn} onClick={save} disabled={!form.name}>
            Save
          </button>
        </div>
      </Modal>
    </>
  );
}
