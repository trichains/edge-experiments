import path from "node:path";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";
import { seedIfEmpty } from "./seed";
import { log } from "../log";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

interface DbState {
  db: Db;
  ready: Promise<void>;
  mode: "postgres" | "sandbox";
  close: () => Promise<void>;
}

/**
 * Module-level singleton stored on globalThis: dev hot reloads re-evaluate this module, but the
 * instance (and the in-flight init promise) survive, so there's never a second PGlite in one process.
 */
const globalForDb = globalThis as typeof globalThis & {
  __edgeExperimentsDb?: DbState;
  __edgeExperimentsDbPending?: Promise<DbState>;
};

export { isSandbox } from "../env";

const migrationsFolder = () => path.join(process.cwd(), "drizzle");

async function createState(): Promise<DbState> {
  if (process.env.DATABASE_URL) {
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
    const db = drizzle({ client: pool, schema }) as unknown as Db;
    // Migrations in Postgres mode run through `npm run db:migrate`; here we only seed an empty DB.
    const ready = seedIfEmpty(db).then(() => log.info("db.ready", { mode: "postgres" }));
    return { db, ready, mode: "postgres", close: () => pool.end() };
  }

  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const client = new PGlite();
  const db = drizzle({ client, schema }) as unknown as Db;
  const ready = (async () => {
    const started = Date.now();
    await migrate(db as never, { migrationsFolder: migrationsFolder() });
    await seedIfEmpty(db);
    log.info("db.ready", { mode: "sandbox", ms: Date.now() - started });
  })();
  return { db, ready, mode: "sandbox", close: () => client.close() };
}

/** Returns a ready database. A failed init is cleared so the next call can retry. */
export async function getDb(): Promise<Db> {
  if (!globalForDb.__edgeExperimentsDbPending) {
    const pending = createState().then(async (state) => {
      globalForDb.__edgeExperimentsDb = state;
      try {
        await state.ready;
      } catch (error) {
        globalForDb.__edgeExperimentsDb = undefined;
        globalForDb.__edgeExperimentsDbPending = undefined;
        await state.close().catch(() => undefined);
        log.error("db.init_failed", { error: String(error) });
        throw error;
      }
      return state;
    });
    pending.catch(() => {
      if (globalForDb.__edgeExperimentsDbPending === pending) globalForDb.__edgeExperimentsDbPending = undefined;
    });
    globalForDb.__edgeExperimentsDbPending = pending;
  }
  const state = await globalForDb.__edgeExperimentsDbPending;
  return state.db;
}

/** Test helper: drop the singleton so the next getDb() starts from a fresh, re-seeded database. */
export async function resetDbForTests(): Promise<void> {
  const pending = globalForDb.__edgeExperimentsDbPending;
  globalForDb.__edgeExperimentsDb = undefined;
  globalForDb.__edgeExperimentsDbPending = undefined;
  const state = await pending?.catch(() => undefined);
  await state?.close();
}
