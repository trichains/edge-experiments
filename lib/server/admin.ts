import { timingSafeEqual } from "node:crypto";
import { isSandbox } from "../env";

export function isAdminProtected(): boolean {
  return Boolean(process.env.ADMIN_TOKEN);
}

/**
 * Dashboard mutations:
 * - ADMIN_TOKEN set: require `Authorization: Bearer <token>` (or `x-admin-token`).
 * - ADMIN_TOKEN unset: allowed only in sandbox mode (public demo, in-memory data). With a real
 *   database and no token, mutations fail closed.
 */
export function isAuthorized(request: Request): boolean {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return isSandbox();
  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : (request.headers.get("x-admin-token") ?? "");
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function unauthorized(): Response {
  const hint = process.env.ADMIN_TOKEN
    ? "send the ADMIN_TOKEN as `Authorization: Bearer <token>`"
    : "mutations are disabled: set ADMIN_TOKEN when DATABASE_URL is configured";
  return Response.json({ error: "unauthorized", hint }, { status: 401 });
}
