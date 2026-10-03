/**
 * Starts the database (and, in sandbox mode, PGlite migrations + seed) as soon as the server boots,
 * instead of on the first request. Not awaited, so it doesn't delay readiness.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getDb } = await import("./lib/db/client");
    void getDb().catch((error: unknown) => {
      console.error(JSON.stringify({ ts: new Date().toISOString(), level: "error", event: "db.init_failed", error: String(error) }));
    });
  }
}
