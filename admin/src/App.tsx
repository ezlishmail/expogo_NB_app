import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { NavLink, Navigate, Outlet, useLocation } from "react-router-dom";
import { api, clearAuth, getToken } from "./api";
export function RequireAuth({ children }: { children: ReactNode }) {
  if (!getToken()) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

const NAV = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/appointments", label: "Appointments" },
  { to: "/orders", label: "Orders" },
  { to: "/services", label: "Services" },
  { to: "/staff", label: "Staff" },
  { to: "/products", label: "Products" },
  { to: "/categories", label: "Categories" },
  { to: "/coupons", label: "Coupons" },
  { to: "/push", label: "Push" },
  { to: "/settings", label: "Settings" },
];

export function AppLayout() {
  return (
    <div className="flex min-h-screen bg-canvas">
      <aside className="w-56 shrink-0 border-r border-gray-200 bg-white">
        <div className="flex h-14 items-center gap-2 border-b border-gray-100 px-5">
          <img src="/logo.png" alt="Northern Bloom" className="h-7 w-auto" />
        </div>
        <nav className="flex flex-col gap-0.5 p-3">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm ${
                  isActive ? "bg-brand/10 font-medium text-brand" : "text-gray-600 hover:bg-gray-100"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <button
          onClick={() => {
            clearAuth();
            window.location.href = "/login";
          }}
          className="mx-3 mt-4 rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
        >
          Sign out
        </button>
      </aside>
      <main className="min-w-0 flex-1 p-8">
        <OutletSlot />
      </main>
    </div>
  );
}

function OutletSlot() {
  const location = useLocation();
  return (
    <div key={location.pathname} className="mx-auto max-w-6xl">
      <Outlet />
    </div>
  );
}

// Tiny data-fetching hook so pages stay dependency-free.
export function useApi<T>(path: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    if (!path) return;
    setLoading(true);
    api<T>(path)
      .then((d) => alive && (setData(d), setError(null)))
      .catch((e) => alive && setError(e))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, reloadKey, ...deps]);

  return { data, error, loading, reload: () => setReloadKey((k) => k + 1) };
}

export function PageTitle({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex items-center justify-between">
      <h1 className="font-display text-2xl font-semibold tracking-tight text-gray-900">{title}</h1>
      {action}
    </div>
  );
}

export function Card({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">{children}</div>;
}

export const btn =
  "rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand/90 disabled:opacity-50";
export const btnGhost =
  "rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50";
export const input =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none";

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-auto rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-xs font-medium text-gray-500">{label}</span>
      {children}
    </label>
  );
}

export function ErrorNote({ message }: { message?: string | null }) {
  if (!message) return null;
  return <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{message}</p>;
}

export function money(cents: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(cents / 100);
}
