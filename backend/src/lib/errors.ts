export class HttpError extends Error {
  statusCode: number;
  code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export const badRequest = (code: string, message: string) => new HttpError(400, code, message);
export const unauthorized = (message = "Authentication required") =>
  new HttpError(401, "UNAUTHORIZED", message);
export const forbidden = (message = "Not allowed") => new HttpError(403, "FORBIDDEN", message);
export const notFound = (message = "Not found") => new HttpError(404, "NOT_FOUND", message);
export const conflict = (code: string, message: string) => new HttpError(409, code, message);

// Maps DB constraint failures we translate into 409/400:
// - P2002: unique violation (duplicate email, etc.)
// - 23P01: exclusion violation on appointments_no_double_booking — Prisma
//   surfaces this as PrismaClientUnknownRequestError, so we match on the
//   embedded Postgres code/message.
export function isUniqueViolation(err: unknown): boolean {
  return constraintCode(err) === "P2002";
}

export function isOverlapViolation(err: unknown): boolean {
  return constraintCode(err) === "23P01";
}

function constraintCode(err: unknown): string | null {
  let cur: unknown = err;
  for (let depth = 0; depth < 4 && typeof cur === "object" && cur !== null; depth++) {
    const e = cur as { code?: string; message?: string; cause?: unknown };
    if (e.code === "P2002" || e.code === "23P01") return e.code;
    if (typeof e.message === "string") {
      if (e.message.includes("23P01")) return "23P01";
      if (e.code === undefined && e.message.includes("exclusion constraint")) return "23P01";
    }
    cur = e.cause;
  }
  return null;
}
