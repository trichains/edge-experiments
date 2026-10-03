import { NextResponse, type NextRequest } from "next/server";
import { ASSIGNMENTS_COOKIE, VISITOR_COOKIE } from "@/lib/core/constants";

/**
 * Dev aid behind the "switch variant" link: forgets the visitor id and the assignments, then
 * redirects back. Bucketing is deterministic per visitor id, so the id has to go too; the next
 * request gets a fresh id and may land in a different variant.
 */
export function GET(request: NextRequest) {
  const next = request.nextUrl.searchParams.get("next") ?? "/demo/landing";
  const target = next.startsWith("/") && !next.startsWith("//") ? next : "/demo/landing";
  const response = NextResponse.redirect(new URL(target, request.url), 303);
  response.cookies.delete(VISITOR_COOKIE);
  response.cookies.delete(ASSIGNMENTS_COOKIE);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
