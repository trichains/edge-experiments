import { CONFIG_CACHE_CONTROL } from "@/lib/core/constants";
import { log } from "@/lib/log";
import { getEdgeConfig } from "@/lib/server/repo";

/**
 * Active experiment + flag config for proxy.ts. The proxy never talks to the database; it fetches
 * this JSON, which a CDN can cache (s-maxage=30, stale-while-revalidate=300).
 * In production on Vercel, Edge Config would be the better home for this payload.
 */
export async function GET(request: Request) {
  try {
    const config = await getEdgeConfig();
    // The version is a hash of the experiments + flags only (not generatedAt), so it's a stable ETag.
    const etag = `"${config.version}"`;
    const headers = { "Cache-Control": CONFIG_CACHE_CONTROL, ETag: etag };
    const ifNoneMatch = request.headers.get("if-none-match");
    if (ifNoneMatch && ifNoneMatch.split(",").some((tag) => tag.trim().replace(/^W\//, "") === etag)) {
      return new Response(null, { status: 304, headers });
    }
    return Response.json(config, { headers });
  } catch (error) {
    log.error("config.failed", { error: String(error) });
    return Response.json({ error: "config_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
