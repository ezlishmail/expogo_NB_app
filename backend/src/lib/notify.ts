import type { Prisma } from "@prisma/client";
import prisma from "../db";
import { sendToTokens, pushConfigured } from "./fcm";

export interface NotifyPayload {
  title: string;
  body?: string | null;
  deeplink?: string | null;
}

// Store an in-app notification for a user and attempt FCM delivery to all
// their registered devices. Never throws.
export async function notifyUser(userId: string, type: string, payload: NotifyPayload): Promise<void> {
  try {
    await prisma.notification.create({
      data: { userId, type, title: payload.title, body: payload.body ?? null, deeplink: payload.deeplink ?? null },
    });
  } catch (err) {
    console.warn("notification row insert failed:", err);
    return;
  }
  await deliverToUserDevices([userId], payload);
}

async function deliverToUserDevices(userIds: string[], payload: NotifyPayload): Promise<void> {
  if (!pushConfigured() || userIds.length === 0) return;
  const devices = await prisma.device.findMany({
    where: { userId: { in: userIds } },
    select: { fcmToken: true },
  });
  if (devices.length === 0) return;
  const { invalidTokens } = await sendToTokens(devices.map((d) => d.fcmToken), payload);
  if (invalidTokens.length > 0) {
    await prisma.device.deleteMany({ where: { fcmToken: { in: invalidTokens } } });
  }
}

// Fan-out to a tenant audience. `marketing` audiences skip users who opted out.
export async function broadcast(
  tenantId: string,
  opts: { title: string; body?: string | null; deeplink?: string | null; marketing: boolean },
): Promise<number> {
  const users = await prisma.user.findMany({
    where: { tenantId, ...(opts.marketing ? { marketingOptIn: true } : {}) },
    select: { id: true },
  });
  if (users.length === 0) return 0;

  await prisma.notification.createMany({
    data: users.map((u) => ({
      userId: u.id,
      type: opts.marketing ? "PROMOTION" : "ANNOUNCEMENT",
      title: opts.title,
      body: opts.body ?? null,
      deeplink: opts.deeplink ?? null,
    })),
  });
  await deliverToUserDevices(users.map((u) => u.id), opts);
  return users.length;
}

export function settingsJson(settings: Prisma.JsonValue): Record<string, unknown> {
  return (settings ?? {}) as Record<string, unknown>;
}
