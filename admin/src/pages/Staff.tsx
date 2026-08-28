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

interface StaffRow {
  id: string;
  name: string;
  bio: string | null;
  active: boolean;
  gender: "MALE" | "FEMALE" | null;
  photoUrl: string | null;
  specialties: string[];
  serviceIds: string[];
  availability: Array<{ weekday: number; startMin: number; endMin: number }>;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const minToTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const timeToMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

export default function Staff() {
  const { data, loading, reload } = useApi<{ staff: StaffRow[] }>("/admin/staff");
  const services = useApi<{ services: Array<{ id: string; name: string }> }>("/admin/services");
  const [editing, setEditing] = useState<StaffRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", bio: "", gender: "", photoUrl: "", specialties: "", serviceIds: [] as string[], availability: [] as StaffRow["availability"] });
  const [error, setError] = useState<string | null>(null);

  function openCreate() {
    setForm({ name: "", bio: "", gender: "", photoUrl: "", specialties: "", serviceIds: [], availability: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, startMin: 630, endMin: 1200 })) });
    setError(null);
    setCreating(true);
  }
  function openEdit(s: StaffRow) {
    setForm({
      name: s.name,
      bio: s.bio ?? "",
      gender: s.gender ?? "",
      photoUrl: s.photoUrl ?? "",
      specialties: s.specialties.join(", "),
      serviceIds: s.serviceIds,
      availability: s.availability,
    });
    setError(null);
    setEditing(s);
  }

  function setDay(weekday: number, on: boolean) {
    const rest = form.availability.filter((a) => a.weekday !== weekday);
    setForm({
      ...form,
      availability: on ? [...rest, { weekday, startMin: 540, endMin: 1020 }] : rest,
    });
  }
  function setHours(weekday: number, key: "startMin" | "endMin", time: string) {
    setForm({
      ...form,
      availability: form.availability.map((a) => (a.weekday === weekday ? { ...a, [key]: timeToMin(time) } : a)),
    });
  }

  async function save() {
    try {
      const body = {
        name: form.name,
        bio: form.bio || null,
        gender: form.gender || null,
        photoUrl: form.photoUrl.trim() || null,
        specialties: form.specialties.split(",").map((t) => t.trim()).filter(Boolean),
        serviceIds: form.serviceIds,
        availability: [...form.availability].sort((a, b) => a.weekday - b.weekday),
      };
      if (editing) await api(`/admin/staff/${editing.id}`, { method: "PATCH", json: body });
      else await api("/admin/staff", { method: "POST", json: body });
      setEditing(null);
      setCreating(false);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function toggleActive(s: StaffRow) {
    if (s.active) await api(`/admin/staff/${s.id}`, { method: "DELETE" });
    else await api(`/admin/staff/${s.id}`, { method: "PATCH", json: { active: true } });
    reload();
  }

  return (
    <>
      <PageTitle
        title="Staff"
        action={
          <button className={btn} onClick={openCreate}>
            + New staff member
          </button>
        }
      />
      {(data?.staff ?? []).some((s) => s.active && s.gender === null) && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Some active stylists have no gender set. Set each stylist's gender below so the app's Gents / Ladies stylist
          filter can work.
        </p>
      )}
      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <Card>
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-gray-500">
              <tr>
                <th className="pb-2">Name</th>
                <th className="pb-2">Services</th>
                <th className="pb-2">Hours</th>
                <th className="pb-2">Status</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {(data?.staff ?? []).map((s) => (
                <tr key={s.id} className="border-t border-gray-100">
                  <td className="py-2 font-medium text-gray-900">
                    <div className="flex items-center gap-2">
                      {s.photoUrl ? (
                        <img src={s.photoUrl} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
                      ) : (
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[10px] text-gray-400">
                          {s.name.slice(0, 1).toUpperCase()}
                        </span>
                      )}
                      <span>
                        {s.name}
                        <span className="ml-1 text-xs font-normal text-gray-400">
                          {s.gender === "MALE" ? "· M" : s.gender === "FEMALE" ? "· F" : "· gender unset"}
                        </span>
                        {s.specialties.length > 0 && (
                          <p className="text-xs font-normal text-gray-500">{s.specialties.join(", ")}</p>
                        )}
                      </span>
                    </div>
                  </td>
                  <td className="text-gray-600">
                    {services.data?.services
                      .filter((sv) => s.serviceIds.includes(sv.id))
                      .map((sv) => sv.name)
                      .join(", ") || "—"}
                  </td>
                  <td className="text-gray-600">
                    {s.availability.length === 0
                      ? "—"
                      : s.availability
                          .slice()
                          .sort((a, b) => a.weekday - b.weekday)
                          .map((a) => `${DAYS[a.weekday]} ${minToTime(a.startMin)}–${minToTime(a.endMin)}`)
                          .join(", ")}
                  </td>
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
        title={editing ? "Edit staff member" : "New staff member"}
      >
        <ErrorNote message={error} />
        <Field label="Name">
          <input className={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Bio">
          <textarea className={input} rows={2} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Gender">
            <select className={input} value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
              <option value="">Not set</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
            </select>
          </Field>
          <Field label="Specialties (comma-separated)">
            <input
              className={input}
              value={form.specialties}
              onChange={(e) => setForm({ ...form, specialties: e.target.value })}
              placeholder="Hair, Bridal"
            />
          </Field>
        </div>
        <Field label="Photo URL">
          <input
            className={input}
            value={form.photoUrl}
            onChange={(e) => setForm({ ...form, photoUrl: e.target.value })}
            placeholder="https://…"
          />
        </Field>
        <Field label="Can perform">
          <div className="flex flex-wrap gap-3">
            {(services.data?.services ?? []).map((sv) => (
              <label key={sv.id} className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={form.serviceIds.includes(sv.id)}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      serviceIds: e.target.checked
                        ? [...form.serviceIds, sv.id]
                        : form.serviceIds.filter((id) => id !== sv.id),
                    })
                  }
                />
                {sv.name}
              </label>
            ))}
          </div>
        </Field>
        <Field label="Working hours">
          <div className="space-y-1">
            {DAYS.map((d, i) => {
              const row = form.availability.find((a) => a.weekday === i);
              return (
                <div key={d} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={!!row} onChange={(e) => setDay(i, e.target.checked)} />
                  <span className="w-10">{d}</span>
                  {row && (
                    <>
                      <input
                        type="time"
                        className="rounded border border-gray-300 px-1.5 py-1"
                        value={minToTime(row.startMin)}
                        onChange={(e) => setHours(i, "startMin", e.target.value)}
                      />
                      –
                      <input
                        type="time"
                        className="rounded border border-gray-300 px-1.5 py-1"
                        value={minToTime(row.endMin)}
                        onChange={(e) => setHours(i, "endMin", e.target.value)}
                      />
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </Field>
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
