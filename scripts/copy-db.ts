/**
 * Row-copy of all app data from one Neon.new DB to another.
 *
 * No pg_dump on serverless → SQL row-copy. Parent tables copied before
 * children (ID-preserving), so FK constraints never fire. Receipts' fileUrl
 * points at Vercel Blob, which outlives any DB — nothing to migrate there.
 */
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import type { PgTable } from "drizzle-orm/pg-core";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../src/db/schema";

const CHUNK = 500;

/** FK-safe order: parents first, IDs preserved so child FKs resolve. */
const TABLE_ORDER: PgTable[] = [
  schema.users,
  schema.accounts,
  schema.sessions,
  schema.verificationTokens,
  schema.moneyAccounts,
  schema.categories,
  schema.contacts,
  schema.transactions,
  schema.transfers,
  schema.loans,
  schema.receipts,
  schema.budgets,
];

export async function copyData(
  sourceUrl: string,
  destUrl: string
): Promise<Record<string, number>> {
  const src = drizzle(neon(sourceUrl), { schema });
  const dst = drizzle(neon(destUrl), { schema });

  const counts: Record<string, number> = {};
  for (const table of TABLE_ORDER) {
    // Row types differ per table; cast at the boundary keeps this uniform.
    const rows = (await src.select().from(table)) as unknown as Record<string, unknown>[];
    for (let i = 0; i < rows.length; i += CHUNK) {
      await dst.insert(table).values(rows.slice(i, i + CHUNK) as never);
    }
    counts[(table as unknown as Record<symbol, string>)[Symbol.for("drizzle:Name")]] = rows.length;
  }
  return counts;
}

export type { NeonHttpDatabase };