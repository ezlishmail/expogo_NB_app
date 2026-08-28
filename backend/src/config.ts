import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  SHADOW_DATABASE_URL: z.string().optional(),
  PORT: z.coerce.number().int().positive().default(3000),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  TENANT_SLUG: z.string().default("northern-bloom"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  // Required, always. No dev fallback: a missing/short secret fails startup
  // regardless of NODE_ENV, so a forgotten env var can never silently ship a
  // publicly-known signing key. Generate one with:
  //   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
  JWT_SECRET: z
    .string({ required_error: "JWT_SECRET is required" })
    .min(32, "JWT_SECRET must be a random string of at least 32 characters"),
  // Raw contents of a Firebase service-account JSON (FCM HTTP v1). Optional:
  // pushes are still stored as in-app notifications when unset.
  FCM_SERVICE_ACCOUNT_JSON: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment configuration:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const API_PREFIX = "/api/v1";
