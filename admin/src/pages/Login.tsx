import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, setAuth, ApiError } from "../api";
import { Card, Field, ErrorNote, input } from "../App";

// Manager roles allowed into this dashboard. Mirrors the server-side
// requireAdmin check (ADMIN / OWNER / DEVELOPER) — the owner must be able to
// sign in here, which the old ADMIN-only check wrongly blocked.
const MANAGER_ROLES = ["ADMIN", "OWNER", "DEVELOPER"];

// Demo / setup logins seeded by prisma/seed.ts. The owner replaces these with
// their own account before launch. The customer demo (demo@northernbloom.app)
// is for the mobile app, not this dashboard, so it is intentionally not here.
const DEMO_LOGINS: Array<{ label: string; email: string; password: string }> = [
  { label: "Owner", email: "owner@northernbloom.app", password: "Owner@12345" },
  { label: "Admin", email: "admin@northernbloom.test", password: "dev-admin-password" },
];

export default function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function doLogin(loginEmail: string, loginPassword: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ token: string; user: { role: string; name: string } }>("/auth/login", {
        method: "POST",
        json: { email: loginEmail, password: loginPassword },
      });
      if (!MANAGER_ROLES.includes(res.user.role)) {
        throw new ApiError(403, "FORBIDDEN", "This dashboard is for owner/staff accounts only");
      }
      setAuth(res.token, res.user);
      nav("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    doLogin(email, password);
  }

  function useDemo(d: { email: string; password: string }) {
    setEmail(d.email);
    setPassword(d.password);
    doLogin(d.email, d.password);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-4">
      <Card>
        <form onSubmit={submit} className="w-80">
          <div className="mb-6 flex flex-col items-center gap-2 text-center">
            <img src="/logo.png" alt="Northern Bloom" className="h-12 w-auto" />
            <p className="text-xs text-gray-500">Owner dashboard</p>
          </div>
          <ErrorNote message={error} />
          <Field label="Email">
            <input
              className={input}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </Field>
          <Field label="Password">
            <input
              className={input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Field>
          <button
            type="submit"
            disabled={busy}
            className="mt-2 w-full rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand/90 disabled:opacity-50"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>

          <div className="mt-6 border-t border-gray-100 pt-4">
            <p className="mb-2 text-center text-[11px] font-medium uppercase tracking-wide text-gray-400">
              Demo logins · replace before launch
            </p>
            <div className="flex gap-2">
              {DEMO_LOGINS.map((d) => (
                <button
                  key={d.email}
                  type="button"
                  disabled={busy}
                  onClick={() => useDemo(d)}
                  className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  {d.label} demo
                </button>
              ))}
            </div>
          </div>
        </form>
      </Card>
    </div>
  );
}
