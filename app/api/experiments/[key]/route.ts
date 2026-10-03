import { z } from "zod";
import { experimentStatusSchema } from "@/lib/core/types";
import { log } from "@/lib/log";
import { isAuthorized, unauthorized } from "@/lib/server/admin";
import { setExperimentStatus, toDefinition } from "@/lib/server/repo";

const bodySchema = z.object({ status: experimentStatusSchema }).strict();

export async function PATCH(request: Request, ctx: RouteContext<"/api/experiments/[key]">) {
  if (!isAuthorized(request)) return unauthorized();
  const { key } = await ctx.params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_payload" }, { status: 400 });
  const row = await setExperimentStatus(key, parsed.data.status);
  if (!row) return Response.json({ error: "not_found" }, { status: 404 });
  log.info("experiment.status", { key, status: parsed.data.status });
  return Response.json(toDefinition(row));
}
