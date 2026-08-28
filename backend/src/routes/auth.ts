import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import argon2 from "@node-rs/argon2";
import prisma from "../db";
import { env } from "../config";
import { badRequest, isUniqueViolation, unauthorized, notFound } from "../lib/errors";
import type { JwtPayload } from "../plugins/auth";

const registerSchema = z.object({
  name: z.string().min(1).max(80),
  email: z.string().email().max(160).transform((v) => v.toLowerCase()),
  password: z.string().min(8).max(72),
  phone: z.string().min(7).max(24).optional(),
});

const loginSchema = z.object({
  email: z.string().email().transform((v) => v.toLowerCase()),
  password: z.string().min(1),
});

function publicUser(u: {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  marketingOptIn: boolean;
}) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    role: u.role,
    marketingOptIn: u.marketingOptIn,
  };
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/auth/register",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const input = registerSchema.parse(request.body);
      const tenant = await prisma.tenant.findUnique({ where: { slug: env.TENANT_SLUG } });
      if (!tenant) throw badRequest("TENANT_NOT_FOUND", "Tenant not configured");

      const passwordHash = await argon2.hash(input.password);
      let user;
      try {
        user = await prisma.user.create({
          data: {
            tenantId: tenant.id,
            role: "CUSTOMER",
            name: input.name,
            email: input.email,
            phone: input.phone ?? null,
            passwordHash,
          },
        });
      } catch (err) {
        if (isUniqueViolation(err)) {
          throw badRequest("EMAIL_TAKEN", "An account with this email already exists");
        }
        throw err;
      }

      const payload: JwtPayload = { sub: user.id, tid: user.tenantId, role: user.role };
      const token = app.jwt.sign(payload, { expiresIn: "30d" });
      return reply.code(201).send({ token, user: publicUser(user) });
    },
  );

  app.post(
    "/auth/login",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const input = loginSchema.parse(request.body);
      const tenant = await prisma.tenant.findUnique({ where: { slug: env.TENANT_SLUG } });
      if (!tenant) throw unauthorized();

      const user = await prisma.user.findUnique({
        where: { tenantId_email: { tenantId: tenant.id, email: input.email } },
      });
      if (!user || !(await argon2.verify(user.passwordHash, input.password))) {
        throw unauthorized("Invalid email or password");
      }

      const payload: JwtPayload = { sub: user.id, tid: user.tenantId, role: user.role };
      const token = app.jwt.sign(payload, { expiresIn: "30d" });
      return reply.send({ token, user: publicUser(user) });
    },
  );
}

export async function meRoutes(app: FastifyInstance): Promise<void> {
  const authed = { preHandler: [app.authenticate] };

  app.get("/me", authed, async (request) => {
    const user = await prisma.user.findUnique({
      where: { id: request.user.sub },
      include: { addresses: true },
    });
    if (!user || user.tenantId !== request.user.tid) throw unauthorized();
    return { user: { ...publicUser(user), addresses: user.addresses } };
  });

  const patchSchema = z.object({
    name: z.string().min(1).max(80).optional(),
    phone: z.string().min(7).max(24).nullable().optional(),
    marketingOptIn: z.boolean().optional(),
    password: z.string().min(8).max(72).optional(),
  });

  app.patch("/me", authed, async (request) => {
    const input = patchSchema.parse(request.body);
    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.phone !== undefined) data.phone = input.phone;
    if (input.marketingOptIn !== undefined) data.marketingOptIn = input.marketingOptIn;
    if (input.password !== undefined) data.passwordHash = await argon2.hash(input.password);

    const user = await prisma.user.update({ where: { id: request.user.sub }, data });
    return { user: publicUser(user) };
  });

  const addressInput = z.object({
    label: z.string().max(40).optional(),
    line1: z.string().min(1).max(200),
    city: z.string().max(80).optional(),
    postalCode: z.string().max(16).optional(),
    notes: z.string().max(300).optional(),
  });

  app.post("/me/addresses", { ...authed }, async (request, reply) => {
    const input = addressInput.parse(request.body);
    const address = await prisma.address.create({
      data: { userId: request.user.sub, label: input.label ?? null, ...input },
    });
    return reply.code(201).send({ address });
  });

  app.delete("/me/addresses/:id", authed, async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await prisma.address.findUnique({ where: { id } });
    if (!existing || existing.userId !== request.user.sub) throw notFound("Address not found");
    await prisma.address.delete({ where: { id } });
    return reply.code(204).send();
  });

  // Account deletion with anonymization: orders/payments are kept for
  // accounting retention; everything identifying is stripped.
  app.delete("/me", authed, async (request, reply) => {
    const userId = request.user.sub;
    const now = new Date();

    await prisma.$transaction([
      prisma.appointment.updateMany({
        where: { customerId: userId, startsAt: { gt: now }, status: { in: ["PENDING", "CONFIRMED"] } },
        data: { status: "CANCELLED" },
      }),
      prisma.device.deleteMany({ where: { userId } }),
      prisma.address.deleteMany({ where: { userId } }),
      prisma.notification.deleteMany({ where: { userId } }),
      prisma.couponRedemption.deleteMany({ where: { userId } }),
      prisma.user.update({
        where: { id: userId },
        data: {
          name: "Deleted user",
          email: `deleted-${randomUUID()}@deleted.local`,
          phone: null,
          passwordHash: `deleted:${randomUUID()}`,
          marketingOptIn: false,
        },
      }),
    ]);

    return reply.code(204).send();
  });
}
