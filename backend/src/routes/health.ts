import type { FastifyInstance } from "fastify";
import prisma from "../db";

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health", async () => {
    let db = "down";
    try {
      await prisma.$queryRaw`SELECT 1`;
      db = "up";
    } catch {
      // reported below; server still answers so the skeleton is testable pre-DB
    }
    return { ok: true, db };
  });
}
