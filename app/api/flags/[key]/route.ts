import { flagPatchSchema } from "@/lib/core/types";
import { log } from "@/lib/log";
import { isAuthorized, unauthorized } from "@/lib/server/admin";
import { toFlag, updateFlag } from "@/lib/server/repo";

export async function PATCH(request: Request, ctx: RouteContext<"/api/flags/[key]">) {
  if (!isAuthorized(request)) return unauthorized();
  const { key } = await ctx.params;
  const parsed = flagPatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "invalid_payload", issues: parsed.error.issues.map((i) => i.message) }, { status: 400 });
  }
  const row = await updateFlag(key, parsed.data);
  if (!row) return Response.json({ error: "not_found" }, { status: 404 });
  log.info("flag.updated", { key, ...parsed.data });
  return Response.json(toFlag(row));
}
