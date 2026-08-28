import { useState } from "react";
import { api } from "../api";
import {
  PageTitle,
  Card,
  Field,
  ErrorNote,
  useApi,
  btn,
  btnGhost,
  input,
} from "../App";

interface Category {
  id: string;
  name: string;
  sortOrder: number;
}

export default function Categories() {
  const { data, loading, reload } = useApi<{ categories: Category[] }>("/admin/categories");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function add() {
    setError(null);
    try {
      await api("/admin/categories", { method: "POST", json: { name, sortOrder: (data?.categories.length ?? 0) + 1 } });
      setName("");
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  async function remove(id: string) {
    setError(null);
    try {
      await api(`/admin/categories/${id}`, { method: "DELETE" });
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <>
      <PageTitle title="Categories" />
      <ErrorNote message={error} />
      <Card>
        <div className="mb-4 flex gap-2">
          <input className={input} placeholder="New category name" value={name} onChange={(e) => setName(e.target.value)} />
          <button className={btn} onClick={add} disabled={!name}>
            Add
          </button>
        </div>
        {loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : (
          <ul className="divide-y divide-gray-100 text-sm">
            {(data?.categories ?? []).map((c) => (
              <li key={c.id} className="flex items-center justify-between py-2">
                <span className="font-medium text-gray-900">{c.name}</span>
                <button className={btnGhost} onClick={() => remove(c.id)}>
                  Delete
                </button>
              </li>
            ))}
            {(data?.categories ?? []).length === 0 && (
              <li className="py-4 text-center text-gray-500">No categories yet.</li>
            )}
          </ul>
        )}
      </Card>
    </>
  );
}
