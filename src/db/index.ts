import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

/** Lazy singleton: construct client only on first real access (runtime),
 *  so build-time page collection never touches the DB. */
let _db: NeonHttpDatabase<typeof schema> | null = null;

function createDb(): NeonHttpDatabase<typeof schema> {
  const sql = neon(process.env.DATABASE_URL ?? "");
  return drizzle(sql, { schema });
}

export const db = new Proxy({} as NeonHttpDatabase<typeof schema>, {
  get(_target, prop) {
    _db ??= createDb();
    return (_db as unknown as Record<PropertyKey, unknown>)[prop];
  },
});

export * as schema from "./schema";