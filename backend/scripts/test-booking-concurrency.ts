// Stage 3 gate: fire N concurrent bookings at the exact same slot.
// Expected result: exactly one 201 CREATED, everything else 409
// APPOINTMENT_SLOT_UNAVAILABLE. Run with the API already running:
//   npx tsx scripts/test-booking-concurrency.ts <baseUrl> <email> <password>
import { API_PREFIX } from "../src/config";

const BASE = process.argv[2] ?? "http://localhost:3000";
const EMAIL = process.argv[3] ?? "gate-test@example.test";
const PASSWORD = "gate-test-password";
const CONCURRENCY = 20;

async function api(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${API_PREFIX}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  return res;
}

// 1. Register a throwaway customer (ignore "already exists").
await api("/auth/register", {
  method: "POST",
  body: JSON.stringify({
    name: "Gate Test",
    email: EMAIL,
    password: PASSWORD,
  }),
});

// 2. Login.
const loginRes = await api("/auth/login", {
  method: "POST",
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});
if (!loginRes.ok) throw new Error(`login failed: ${loginRes.status}`);
const { token } = (await loginRes.json()) as { token: string };
const auth = { authorization: `Bearer ${token}` };

// 3. Find the first bookable slot on the first day with availability within
//    the next 14 days.
const servicesRes = await api("/services");
const { services } = (await servicesRes.json()) as {
  services: Array<{ id: string; durationMin: number }>;
};
if (services.length === 0) throw new Error("no services seeded");

let slot: { startsAt: string; staffId: string } | null = null;
for (let d = 1; d <= 14 && !slot; d++) {
  const date = new Date(Date.now() + d * 86400_000).toISOString().slice(0, 10);
  const availRes = await api(`/availability?serviceId=${services[0].id}&date=${date}`, { headers: auth });
  if (!availRes.ok) continue;
  const { slots } = (await availRes.json()) as { slots: Array<{ startsAt: string; staffId: string }> };
  if (slots.length > 0) slot = slots[0];
}
if (!slot) throw new Error("no available slot found in the next 14 days");

console.log(`Firing ${CONCURRENCY} concurrent bookings for ${slot.startsAt} (staff ${slot.staffId}) ...`);

// 4. The race — same staff, same instant.
const results = await Promise.all(
  Array.from({ length: CONCURRENCY }, () =>
    api("/appointments", {
      method: "POST",
      headers: auth,
      body: JSON.stringify({
        serviceId: services[0].id,
        staffId: slot!.staffId,
        startsAt: slot!.startsAt,
      }),
    }).then(async (res) => ({
      status: res.status,
      code: ((await res.json()) as { error?: { code?: string } }).error?.code,
    })),
  ),
);

const created = results.filter((r) => r.status === 201);
const conflicts = results.filter((r) => r.status === 409 && r.code === "APPOINTMENT_SLOT_UNAVAILABLE");
const other = results.filter((r) => r.status !== 201 && !(r.status === 409 && r.code === "APPOINTMENT_SLOT_UNAVAILABLE"));

console.log(`created=${created.length} conflict(409)=${conflicts.length} other=${other.length}`);
if (other.length > 0) console.log("unexpected:", other.slice(0, 5));

if (created.length !== 1 || created.length + conflicts.length !== CONCURRENCY) {
  console.error("GATE FAILED");
  process.exit(1);
}
console.log("GATE PASSED: exactly one booking won the race.");
