import type { FastifyInstance } from "fastify";
import { z } from "zod";
import prisma from "../db";
import { forbidden } from "../lib/errors";

export async function deviceRoutes(app: FastifyInstance): Promise<void> {
  const authed = { preHandler: [app.authenticate] };

  // Register/upsert this installation's FCM token. Tokens are device-scoped,
  // never a permanent identity: re-registrations rebind to the current user.
  app.post("/devices", authed, async (request, reply) => {
    const input = z
      .object({
        fcmToken: z.string().min(16).max(512),
        platform: z.enum(["android", "ios"]).default("android"),
      })
      .parse(request.body);

    await prisma.device.upsert({
      where: { fcmToken: input.fcmToken },
      update: { userId: request.user.sub, platform: input.platform, lastActiveAt: new Date() },
      create: {
        userId: request.user.sub,
        fcmToken: input.fcmToken,
        platform: input.platform,
      },
    });
    return reply.code(201).send({ ok: true });
  });

  app.delete("/devices/:token", authed, async (request) => {
    const { token } = request.params as { token: string };
    const device = await prisma.device.findUnique({ where: { fcmToken: token } });
    if (device && device.userId !== request.user.sub) throw forbidden();
    await prisma.device.deleteMany({ where: { fcmToken: token, userId: request.user.sub } });
    return { ok: true };
  });
}
