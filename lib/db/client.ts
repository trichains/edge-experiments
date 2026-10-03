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

const globalForDb = globalThis as typeof globalThis & { __edgeExperimentsDb?: DbState };

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

let pending: Promise<DbState> | undefined;

/**
 * Module-level singleton stored on globalThis so dev hot reloads and every route in the same
 * process share one PGlite instance (and therefore the same in-memory data).
 */
export async function getDb(): Promise<Db> {
  if (!globalForDb.__edgeExperimentsDb) {
    pending ??= createState().then((state) => {
      globalForDb.__edgeExperimentsDb = state;
      return state;
    });
    await pending;
  }
  const state = globalForDb.__edgeExperimentsDb!;
  await state.ready;
  return state.db;
}

/** Test helper: drop the singleton so the next getDb() starts from a fresh, re-seeded database. */
export async function resetDbForTests(): Promise<void> {
  const state = globalForDb.__edgeExperimentsDb;
  globalForDb.__edgeExperimentsDb = undefined;
  pending = undefined;
  if (state) {
    await state.ready.catch(() => undefined);
    await state.close();
  }
}
