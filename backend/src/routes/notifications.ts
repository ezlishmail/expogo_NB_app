import type { FastifyInstance } from "fastify";
import { z } from "zod";
import prisma from "../db";
import { notFound } from "../lib/errors";

export async function notificationRoutes(app: FastifyInstance): Promise<void> {
  const authed = { preHandler: [app.authenticate] };

  app.get("/notifications", authed, async (request) => {
    const q = z
      .object({ cursor: z.string().optional(), limit: z.coerce.number().int().min(1).max(50).default(20) })
      .parse(request.query);

    const rows = await prisma.notification.findMany({
      where: { userId: request.user.sub },
      orderBy: { createdAt: "desc" },
      take: q.limit + 1,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > q.limit;
    return {
      notifications: rows.slice(0, q.limit).map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        deeplink: n.deeplink,
        read: n.readAt !== null,
        createdAt: n.createdAt.toISOString(),
      })),
      nextCursor: hasMore ? rows[q.limit - 1]?.id ?? null : null,
    };
  });

  app.patch("/notifications/:id/read", authed, async (request) => {
    const { id } = request.params as { id: string };
    const n = await prisma.notification.findUnique({ where: { id } });
    if (!n || n.userId !== request.user.sub) throw notFound("Notification not found");
    await prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
    return { ok: true };
  });

  app.post("/notifications/read-all", authed, async (request) => {
    await prisma.notification.updateMany({
      where: { userId: request.user.sub, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true };
  });
}
