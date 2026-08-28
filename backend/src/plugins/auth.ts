import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import jwt from "@fastify/jwt";
import { env } from "../config";

export interface JwtPayload {
  sub: string;
  tid: string;
  role: "CUSTOMER" | "STAFF" | "COUNTER" | "OWNER" | "ADMIN" | "DEVELOPER";
}

// Roles that may use the admin dashboard / admin API. Mirrors the NYX SYS
// role model: owner runs the salon, developer supports it.
const MANAGER_ROLES: ReadonlySet<string> = new Set(["ADMIN", "OWNER", "DEVELOPER"]);
export const isManagerRole = (role: string): boolean => MANAGER_ROLES.has(role);

export type AuthedRequest = FastifyRequest & { user: JwtPayload };

declare module "fastify" {
  interface FastifyRequest {
    user: JwtPayload;
  }
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireAdmin: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

async function verify(request: FastifyRequest, reply: FastifyReply): Promise<boolean> {
  try {
    await request.jwtVerify();
    return true;
  } catch {
    void reply.code(401).send({
      error: { code: "UNAUTHORIZED", message: "Authentication required" },
    });
    return false;
  }
}

// Called directly on the root instance (not via app.register) so decorators
// and the JWT plugin stay visible to every route module.
export async function registerAuth(app: FastifyInstance): Promise<void> {
  await app.register(jwt, { secret: env.JWT_SECRET });

  app.decorate("authenticate", async (request: FastifyRequest, reply: FastifyReply) => {
    await verify(request, reply);
  });

  app.decorate("requireAdmin", async (request: FastifyRequest, reply: FastifyReply) => {
    const ok = await verify(request, reply);
    if (!ok) return;
    if (!isManagerRole((request.user as JwtPayload).role)) {
      void reply.code(403).send({
        error: { code: "FORBIDDEN", message: "Admin access required" },
      });
    }
  });
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}
