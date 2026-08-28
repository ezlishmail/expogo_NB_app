import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { ZodError } from "zod";
import { env, API_PREFIX } from "./config";
import { registerAuth } from "./plugins/auth";
import { healthRoutes } from "./routes/health";
import { authRoutes, meRoutes } from "./routes/auth";
import { configRoutes } from "./routes/config";
import { serviceRoutes } from "./routes/services";
import { catalogRoutes } from "./routes/catalog";
import { appointmentRoutes } from "./routes/appointments";
import { deviceRoutes } from "./routes/devices";
import { notificationRoutes } from "./routes/notifications";
import { shopRoutes } from "./routes/shop";
import { adminRoutes } from "./routes/admin";

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: true,
  });

  await app.register(cors, { origin: env.CORS_ORIGIN });
  await app.register(helmet);
  await app.register(rateLimit, {
    max: 120,
    timeWindow: "1 minute",
  });

  // Lenient JSON parsing: bodyless POST/PATCH/DELETE (e.g. cancel endpoints)
  // are treated as {} instead of erroring.
  app.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (_req, body: string, done) => {
      if (!body || body.trim() === "") return done(null, {});
      try {
        done(null, JSON.parse(body));
      } catch (err) {
        done(err as Error, undefined);
      }
    },
  );

  app.setNotFoundHandler((_request, reply) => {
    void reply.code(404).send({
      error: { code: "NOT_FOUND", message: "Route not found" },
    });
  });

  app.setErrorHandler((rawErr, _request, reply) => {
    if (rawErr instanceof ZodError) {
      return reply.code(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request",
          details: rawErr.flatten().fieldErrors,
        },
      });
    }
    const err = rawErr as { statusCode?: number; code?: string; message?: string };
    if (typeof err.statusCode === "number" && err.statusCode < 500) {
      return reply.code(err.statusCode).send({
        error: {
          code: err.code ?? "REQUEST_ERROR",
          message: err.message ?? "Request failed",
        },
      });
    }
    app.log.error(rawErr);
    return reply.code(500).send({
      error: { code: "INTERNAL", message: "Something went wrong" },
    });
  });

  await registerAuth(app);

  await app.register(healthRoutes, { prefix: API_PREFIX });
  await app.register(authRoutes, { prefix: API_PREFIX });
  await app.register(meRoutes, { prefix: API_PREFIX });
  await app.register(configRoutes, { prefix: API_PREFIX });
  await app.register(serviceRoutes, { prefix: API_PREFIX });
  await app.register(catalogRoutes, { prefix: API_PREFIX });
  await app.register(appointmentRoutes, { prefix: API_PREFIX });
  await app.register(deviceRoutes, { prefix: API_PREFIX });
  await app.register(notificationRoutes, { prefix: API_PREFIX });
  await app.register(shopRoutes, { prefix: API_PREFIX });
  await app.register(adminRoutes, { prefix: API_PREFIX });

  return app;
}
