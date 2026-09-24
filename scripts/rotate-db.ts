/**
 * Neon.new prod DB rotation:
 *   check expiry (authoritative via neon.new API) → if < 2h left (or --force),
 *   provision a fresh claimable DB → migrate → copy all data → publish new
 *   pointer (Vercel Blob in prod, .env.local locally) → release lock.
 *
 * Usage:
 *   npm run db:rotate          # no-op unless DB expires within 2h
 *   npm run db:rotate:force    # rotate regardless
 *
 * Also imported by /api/cron/rotate-db (Vercel Cron, hourly).
 */
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";
import * as schema from "../src/db/schema";
import {
  getActiveDb,
  publishDbState,
  releaseLock,
  tryAcquireLock,
  type ActiveDb,
} from "../src/lib/db-state";
import { copyData } from "./copy-db";

const ROTATE_LEAD_MS = 2 * 60 * 60 * 1000; // rotate 2h before expiry

const NEON_NEW_API = "https://neon.new/api/v1/database";
const REFERRER = encodeURIComponent("npm:jejakuang|prod");

interface NeonNewInfo {
  id: string;
  status: string;
  expires_at: string;
  claim_url?: string;
  connection_string?: string;
}

/** Managed env lines mirror scripts/provision-db.ts (kept in sync). */
const MANAGED_PREFIXES = [
  "DATABASE_URL=",
  "DATABASE_URL_DIRECT=",
  "PUBLIC_POSTGRES_CLAIM_URL=",
  "# Claimable DB expires at:",
  "# Claim it now:",
  "# Claim it now to your account using the link below:",
];

async function neonNewGet(dbId: string): Promise<NeonNewInfo | null> {
  const res = await fetch(`${NEON_NEW_API}/${dbId}`, {
    headers: { "Content-Type": "application/json" },
  });
  if (res.status === 404) return null; // DB already reaped by Neon
  if (!res.ok) throw new Error(`neon.new GET ${dbId} failed: ${res.status}`);
  return res.json();
}

async function neonNewCreate(): Promise<NeonNewInfo> {
  const dbId = randomUUID();
  const res = await fetch(`${NEON_NEW_API}/${dbId}?referrer=${REFERRER}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enable_logical_replication: false }),
  });
  if (!res.ok) throw new Error(`neon.new create failed: ${res.status}`);
  const info = await neonNewGet(dbId);
  if (!info) throw new Error("neon.new created DB but GET returned nothing");
  return info;
}

/** Local-only fallback: recover dbId/expiry/comments from .env.local. */
function readLocalEnv(): { dbId?: string; expiresAt?: string; url?: string } {
  const envPath = ".env.local";
  if (!existsSync(envPath)) return {};
  const content = readFileSync(envPath, "utf8");
  const url = content.match(/^DATABASE_URL=(.+)$/m)?.[1];
  const expiresAt = content.match(/^# Claimable DB expires at: (.+)$/m)?.[1];
  const claimUrl = content.match(/^# Claim it now: (.+)$/m)?.[1];
  const dbId = claimUrl?.match(/\/database\/([\w-]+)/)?.[1];
  return { dbId, expiresAt, url };
}

/** Rewrite .env.local managed block (local runs; Vercel uses Blob instead). */
function persistEnv(state: ActiveDb) {
  if (!existsSync(".env.local")) return;
  const existing = readFileSync(".env.local", "utf8");
  const kept = existing
    .split("\n")
    .filter((l) => !MANAGED_PREFIXES.some((p) => l.startsWith(p)))
    .join("\n")
    .replace(/\n{2,}/g, "\n")
    .replace(/\n+$/, "");
  writeFileSync(
    ".env.local",
    `${kept}\n\nDATABASE_URL=${state.url}\n# Claimable DB expires at: ${state.expiresAt}\n# Claim it now: ${state.claimUrl}\n`
  );
  console.log("DATABASE_URL rewritten in .env.local");
}

export interface RotateResult {
  rotated: boolean;
  reason: string;
  expiresAt?: string;
  claimUrl?: string;
  counts?: Record<string, number>;
}

export async function rotateDb(opts: { force?: boolean } = {}): Promise<RotateResult> {
  const force = !!opts.force;

  // Resolve current DB from Blob (prod) or .env.local (local).
  const state = await getActiveDb();
  const local = readLocalEnv();
  const dbId = state?.dbId ?? local.dbId;
  let sourceUrl = state?.url ?? local.url ?? process.env.DATABASE_URL ?? "";
  let expiresAt: string | null = state?.expiresAt ?? local.expiresAt ?? null;

  // Authoritative expiry + connection string straight from neon.new.
  if (dbId) {
    const info = await neonNewGet(dbId);
    if (info) {
      expiresAt = info.expires_at;
      sourceUrl = info.connection_string ?? sourceUrl;
    } else {
      console.warn(`DB ${dbId} already reaped by Neon — fresh start, no copy.`);
      sourceUrl = "";
      expiresAt = null;
    }
  }

  if (!force && sourceUrl && expiresAt) {
    const remaining = new Date(expiresAt).getTime() - Date.now();
    if (remaining > ROTATE_LEAD_MS) {
      return {
        rotated: false,
        reason: `DB expires in ${(remaining / 3_600_000).toFixed(1)}h — more than 2h lead, skip`,
        expiresAt,
      };
    }
  }

  const lock = await tryAcquireLock();
  if (!lock.ok) return { rotated: false, reason: lock.reason };

  try {
    const fresh = await neonNewCreate();
    const newUrl = fresh.connection_string;
    if (!newUrl) throw new Error("neon.new returned no connection_string");

    console.log("Running migrations on fresh DB…");
    await migrate(drizzle(neon(newUrl), { schema }), { migrationsFolder: "./drizzle" });

    const counts = sourceUrl ? await copyData(sourceUrl, newUrl) : {};
    const next: ActiveDb = {
      url: newUrl,
      claimUrl: fresh.claim_url ?? `https://neon.new/database/${fresh.id}`,
      expiresAt: fresh.expires_at,
      dbId: fresh.id,
    };
    await publishDbState(next);
    persistEnv(next);
    return {
      rotated: true,
      reason: `rotated → ${next.dbId}`,
      expiresAt: next.expiresAt,
      claimUrl: next.claimUrl,
      counts,
    };
  } finally {
    await releaseLock();
  }
}

// Direct CLI run (tsx). Never auto-run inside Next: argv[1] is the tsx script
// path here, but the Next runtime/bundler entry in every other environment.
const isCli = !!process.argv[1] && process.argv[1].endsWith("rotate-db.ts");
if (isCli) {
  const force = process.argv.includes("--force");
  rotateDb({ force })
    .then((r) => {
      console.log(r.rotated ? "ROTATED" : "SKIP", `— ${r.reason}`);
      if (r.counts) console.log("rows copied:", JSON.stringify(r.counts));
      if (r.rotated) console.log(`expires_at: ${r.expiresAt}\nclaim_url: ${r.claimUrl}`);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}