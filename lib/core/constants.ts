export const VISITOR_COOKIE = "ex_vid";
export const ASSIGNMENTS_COOKIE = "ex_a";
export const EXPERIMENTS_HEADER = "x-experiments";
export const FLAGS_HEADER = "x-flags";
export const VISITOR_HEADER = "x-visitor-id";
export const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/** Visitor ids are UUIDs minted by the proxy; synthetic ones use other prefixes and never come from cookies. */
export const VISITOR_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Cache policy for GET /api/config: CDN keeps it 30s, then serves stale for up to 5 min while refreshing. */
export const CONFIG_CACHE_CONTROL = "public, s-maxage=30, stale-while-revalidate=300";
