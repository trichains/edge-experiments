import { timingSafeEqual } from "node:crypto";

/** Dashboard mutations are open when ADMIN_TOKEN is unset (sandbox demo) and require it otherwise. */
export function isAdminProtected(): boolean {
  return Boolean(process.env.ADMIN_TOKEN);
}

export function isAuthorized(request: Request): boolean {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return true;
  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : (request.headers.get("x-admin-token") ?? "");
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function unauthorized(): Response {
  return Response.json({ error: "unauthorized", hint: "send the ADMIN_TOKEN as `Authorization: Bearer <token>`" }, { status: 401 });
}
