// Minimal FCM HTTP v1 client. Signs an RS256 service-account JWT with node
// crypto and exchanges it for an OAuth2 access token — no firebase-admin
// dependency. All sends are best-effort; failures never break API requests.

import { createSign } from "node:crypto";
import { env } from "../config";

interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
}

export interface FcmPayload {
  title: string;
  body?: string | null;
  deeplink?: string | null;
}

let cachedAccount: ServiceAccount | null | undefined;
let cachedToken: { value: string; expiresAt: number } | null = null;

function serviceAccount(): ServiceAccount | null {
  if (cachedAccount !== undefined) return cachedAccount;
  const raw = env.FCM_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    cachedAccount = null;
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as ServiceAccount;
    if (!parsed.client_email || !parsed.private_key || !parsed.project_id) throw new Error("missing fields");
    cachedAccount = parsed;
  } catch (err) {
    console.error("FCM_SERVICE_ACCOUNT_JSON is not a valid service account:", err);
    cachedAccount = null;
  }
  return cachedAccount;
}

async function accessToken(sa: ServiceAccount): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;

  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const claims = Buffer.from(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  ).toString("base64url");
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  const signature = signer.sign(sa.private_key).toString("base64url");
  const assertion = `${header}.${claims}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }).toString(),
  });
  if (!res.ok) throw new Error(`FCM token exchange failed (${res.status})`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return json.access_token;
}

export function pushConfigured(): boolean {
  return serviceAccount() !== null;
}

// Sends to the given tokens. Returns the subset of tokens that are dead and
// should be deleted from the devices table.
export async function sendToTokens(
  tokens: string[],
  payload: FcmPayload,
): Promise<{ invalidTokens: string[] }> {
  const sa = serviceAccount();
  const invalidTokens: string[] = [];
  if (!sa || tokens.length === 0) return { invalidTokens };

  const token = await accessToken(sa);
  const url = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;

  await Promise.all(
    tokens.map(async (t) => {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
          body: JSON.stringify({
            message: {
              token: t,
              notification: { title: payload.title, body: payload.body ?? "" },
              data: payload.deeplink ? { deeplink: payload.deeplink } : undefined,
              android: { priority: "HIGH" },
            },
          }),
        });
        if (res.status === 404 || res.status === 410 || res.status === 400) {
          invalidTokens.push(t);
        } else if (res.status === 429) {
          console.warn("FCM rate limited; token send skipped");
        } else if (!res.ok) {
          console.warn(`FCM send failed (${res.status})`);
        }
      } catch (err) {
        console.warn("FCM send error:", err);
      }
    }),
  );

  return { invalidTokens };
}
