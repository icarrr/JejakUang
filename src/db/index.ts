import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import { getActiveDb, getActiveDbSync, isNearExpiry, resetDbStateCache } from "../lib/db-state";
import { rotateDb } from "../../scripts/rotate-db";
import * as schema from "./schema";

/** Lazy singleton: construct client only on first real access (runtime),
 *  so build-time page collection never touches the DB. */
let _db: NeonHttpDatabase<typeof schema> | null = null;
let _url: string | null = null;
let rotationFired = false;

function createDb(url: string): NeonHttpDatabase<typeof schema> {
  return drizzle(neon(url), { schema });
}

function refreshUrl(): Promise<void> {
  return getActiveDb().then(async (state) => {
    if (!state) return;
    if (state.url !== _url) {
      // Blob pointer changed (rotation) → rebind this instance.
      _db = createDb(state.url);
      _url = state.url;
    }
    if (rotationFired) return;
    if (!isNearExpiry(state)) return;
    // Within 2h of Neon reap → rotate before the old DB dies. `after()`
    // keeps this instance alive past the response so the rotation finishes.
    // Schedulers (GH Actions hourly + Vercel daily cron) are the primary
    // trigger; this is the last-resort backstop when the app is in use.
    rotationFired = true;
    const { after } = await import("next/server");
    after(async () => {
      try {
        await rotateDb({ force: true });
        resetDbStateCache();
        _url = null; // force rebind from fresh pointer on next access
      } catch (e) {
        console.error("in-app DB rotation failed:", e);
      }
    });
  });
}

export const db = new Proxy({} as NeonHttpDatabase<typeof schema>, {
  get(_target, prop) {
    if (!_db) {
      // Prod: instrumentation.ts register() pre-warms the blob pointer cache
      // before requests, so the pointer URL is the single source of truth
      // (no Vercel DATABASE_URL env — it would go stale after rotation).
      // Local/scripts: fall back to env DATABASE_URL (.env.local).
      const pointer = getActiveDbSync();
      if (pointer) {
        _url = pointer.url;
      } else {
        _url = process.env.DATABASE_URL ?? "";
        void refreshUrl(); // still rebind if the async read differs
      }
      _db = createDb(_url);
    }
    return (_db as unknown as Record<PropertyKey, unknown>)[prop];
  },
});

export * as schema from "./schema";