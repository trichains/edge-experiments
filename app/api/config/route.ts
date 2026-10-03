import { CONFIG_CACHE_CONTROL } from "@/lib/core/constants";
import { log } from "@/lib/log";
import { getEdgeConfig } from "@/lib/server/repo";

/**
 * Active experiment + flag config for proxy.ts. The proxy never talks to the database; it fetches
 * this JSON, which a CDN can cache (s-maxage=30, stale-while-revalidate=300).
 * In production on Vercel, Edge Config would be the better home for this payload.
 */
export async function GET() {
  try {
    const config = await getEdgeConfig();
    return Response.json(config, {
      headers: { "Cache-Control": CONFIG_CACHE_CONTROL, ETag: `"${config.version}"` },
    });
  } catch (error) {
    log.error("config.failed", { error: String(error) });
    return Response.json({ error: "config_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
