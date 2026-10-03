/** Sandbox mode: no DATABASE_URL, so data lives in an in-memory PGlite instance. */
export function isSandbox(): boolean {
  return !process.env.DATABASE_URL;
}
