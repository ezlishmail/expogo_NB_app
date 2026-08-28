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

interface Product {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  categoryId: string | null;
  stock: number;
  trackStock: boolean;
  active: boolean;
  featured: boolean;
}

const empty = {
  name: "",
  description: "",
  priceRupees: "0.00",
  categoryId: "",
  stock: 0,
  trackStock: true,
  featured: false,
};

export default function Products() {
  const { data, loading, reload } = useApi<{ products: Product[] }>("/admin/products");
  const cats = useApi<{ categories: Array<{ id: string; name: string }> }>("/admin/categories");
  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);
  const [stockFor, setStockFor] = useState<Product | null>(null);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState<string | null>(null);

  function openCreate() {
    setForm(empty);
    setError(null);
    setCreating(true);
  }
  function openEdit(p: Product) {
    setForm({
      name: p.name,
      description: p.description ?? "",
      priceRupees: (p.priceCents / 100).toFixed(2),
      categoryId: p.categoryId ?? "",
      stock: p.stock,
      trackStock: p.trackStock,
      featured: p.featured,
    });
    setError(null);
    setEditing(p);
  }

  async function save() {
    try {
      const body = {
        name: form.name,
        description: form.description || null,
        priceCents: Math.round(parseFloat(form.priceRupees) * 100),
        categoryId: form.categoryId || null,
        stock: Number(form.stock),
        trackStock: form.trackStock,
        featured: form.featured,
      };
      if (editing) await api(`/admin/products/${editing.id}`, { method: "PATCH", json: body });
      else await api("/admin/products", { method: "POST", json: body });
      setEditing(null);
      setCreating(false);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function toggleActive(p: Product) {
    await api(`/admin/products/${p.id}`, { method: "PATCH", json: { active: !p.active } });
    reload();
  }

  return (
    <>
      <PageTitle
        title="Products"
        action={
          <button className={btn} onClick={openCreate}>
            + New product
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
                <th className="pb-2">Product</th>
                <th className="pb-2">Category</th>
                <th className="pb-2">Price</th>
                <th className="pb-2">Stock</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {(data?.products ?? []).map((p) => (
                <tr key={p.id} className={`border-t border-gray-100 ${p.active ? "" : "opacity-50"}`}>
                  <td className="py-2 font-medium text-gray-900">
                    {p.featured && <span title="Featured" className="mr-1 text-amber-500">★</span>}
                    {p.name}
                  </td>
                  <td className="text-gray-600">
                    {cats.data?.categories.find((c) => c.id === p.categoryId)?.name ?? "—"}
                  </td>
                  <td>{money(p.priceCents)}</td>
                  <td>
                    {p.trackStock ? (
                      <span className={p.stock <= 5 ? "font-medium text-amber-600" : ""}>{p.stock}</span>
                    ) : (
                      "∞"
                    )}
                  </td>
                  <td className="py-2 text-right">
                    <button className={btnGhost} onClick={() => openEdit(p)}>
                      Edit
                    </button>{" "}
                    {p.trackStock && (
                      <>
                        <button className={btnGhost} onClick={() => setStockFor(p)}>
                          Stock
                        </button>{" "}
                      </>
                    )}
                    <button className={btnGhost} onClick={() => toggleActive(p)}>
                      {p.active ? "Disable" : "Enable"}
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
        title={editing ? "Edit product" : "New product"}
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
        <div className="grid grid-cols-3 gap-3">
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
          <Field label="Stock">
            <input
              className={input}
              type="number"
              min="0"
              value={form.stock}
              onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })}
            />
          </Field>
          <Field label="Category">
            <select className={input} value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
              <option value="">—</option>
              {(cats.data?.categories ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="mb-3 flex gap-6">
          <label className="flex items-center gap-1.5 text-sm">
            <input type="checkbox" checked={form.trackStock} onChange={(e) => setForm({ ...form, trackStock: e.target.checked })} />
            Track stock
          </label>
          <label className="flex items-center gap-1.5 text-sm">
            <input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} />
            Featured on home
          </label>
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

      {stockFor && <StockModal product={stockFor} onClose={() => setStockFor(null)} onDone={reload} />}
    </>
  );
}

// Stock adjustments are logged with a required reason (restock, damage, count
// correction…) so the owner has an audit trail of why a count changed, not just
// the resulting number. Posts to /admin/products/:id/stock; the server rejects
// changes that would drive stock negative (STOCK_NEGATIVE).
function StockModal({ product, onClose, onDone }: { product: Product; onClose: () => void; onDone: () => void }) {
  const { data, reload } = useApi<{
    adjustments: Array<{ id: string; delta: number; reason: string; createdAt: string }>;
  }>(`/admin/products/${product.id}/stock`);
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    const d = parseInt(delta, 10);
    if (!d || Number.isNaN(d)) {
      setError("Enter a non-zero whole number — e.g. 12 to add stock, -3 to remove.");
      return;
    }
    if (!reason.trim()) {
      setError("A reason is required.");
      return;
    }
    setBusy(true);
    try {
      await api(`/admin/products/${product.id}/stock`, { method: "POST", json: { delta: d, reason: reason.trim() } });
      setDelta("");
      setReason("");
      reload();
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Adjustment failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Adjust stock · ${product.name}`}>
      <ErrorNote message={error} />
      <p className="mb-3 text-sm text-gray-600">
        Current stock: <span className="font-medium text-gray-900">{product.stock}</span>
      </p>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Change (+/−)">
          <input
            className={input}
            type="number"
            step="1"
            placeholder="12 or -3"
            value={delta}
            onChange={(e) => setDelta(e.target.value)}
          />
        </Field>
        <div className="col-span-2">
          <Field label="Reason">
            <input
              className={input}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Restock, damaged, count correction…"
            />
          </Field>
        </div>
      </div>
      <div className="mb-4 flex justify-end">
        <button className={btn} onClick={submit} disabled={busy}>
          {busy ? "Saving…" : "Record adjustment"}
        </button>
      </div>
      <h3 className="mb-2 text-xs font-semibold uppercase text-gray-500">Recent adjustments</h3>
      {(data?.adjustments ?? []).length === 0 ? (
        <p className="text-sm text-gray-400">No adjustments yet.</p>
      ) : (
        <ul className="max-h-56 space-y-1 overflow-y-auto text-sm">
          {(data?.adjustments ?? []).map((a) => (
            <li key={a.id} className="flex items-baseline justify-between gap-2 border-t border-gray-100 py-1">
              <span className={`font-medium ${a.delta > 0 ? "text-green-700" : "text-red-600"}`}>
                {a.delta > 0 ? `+${a.delta}` : a.delta}
              </span>
              <span className="flex-1 text-gray-600">{a.reason}</span>
              <span className="shrink-0 text-xs text-gray-400">{new Date(a.createdAt).toLocaleDateString()}</span>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
