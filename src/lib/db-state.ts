/**
 * Active-DB pointer + rotation lock, stored in Vercel Blob.
 *
 * Vercel env is baked at deploy time, so the rotating Neon.new DB URL cannot
 * live in process.env. Every serverless instance reads the current pointer
 * from Blob (TTL-cached per instance) and falls back to DATABASE_URL.
 *
 * Edge-safe by design: token uses the global Web Crypto `crypto.randomUUID()`
 * (present in Node 19+/V8 edge), so no node: import forces Node-only bundling.
 */
import { del, get, put } from "@vercel/blob";

export interface ActiveDb {
  url: string;
  claimUrl: string;
  expiresAt: string; // ISO — authoritative expiry from neon.new
  dbId: string;
}

const POINTER_PATH = "jejakuang/db.json";
const LOCK_PATH = "jejakuang/rotate-lock.json";
const CACHE_TTL_MS = 60_000;
const LOCK_TTL_MS = 10 * 60_000;

/** Rotate this long before Neon reaps the ephemeral DB (user-requested). */
export const ROTATE_LEAD_MS = 2 * 60 * 60 * 1000;

export function isNearExpiry(state: ActiveDb, now: number = Date.now()): boolean {
  return now >= new Date(state.expiresAt).getTime() - ROTATE_LEAD_MS;
}

/** Drop the per-instance pointer cache after a rotation publishes a new one. */
export function resetDbStateCache(): void {
  cached = null;
}

let cached: { state: ActiveDb; at: number } | null = null;
let inflight: Promise<ActiveDb | null> | null = null;

const blobConfigured = () => !!getBlobToken();

/** SDK only auto-reads BLOB_READ_WRITE_TOKEN; we expose our own name and pass
 *  it explicitly so no extra Vercel env var is needed. */
function getBlobToken(): string | undefined {
  return process.env.STORAGE_BLOB_READ_WRITE_TOKEN ?? process.env.BLOB_READ_WRITE_TOKEN;
}

async function readBlob(blobPath: string): Promise<unknown | null> {
  if (!blobConfigured()) return null;
  const res = await get(blobPath, { access: "public", token: getBlobToken() });
  if (!res || !res.stream) return null;
  return JSON.parse(await new Response(res.stream).text());
}

/** Current active DB (blob), TTL-cached with in-flight dedupe. */
export function getActiveDb(): Promise<ActiveDb | null> {
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return Promise.resolve(cached.state);
  }
  inflight ??= readBlob(POINTER_PATH)
    .then((raw) => {
      if (!raw) return null;
      const state = raw as ActiveDb;
      cached = { state, at: Date.now() };
      return state;
    })
    .catch(() => null)
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/**
 * Sync view of the pointer cache — non-null only after getActiveDb() warmed
 * it (production instances pre-warm via instrumentation.ts register()).
 */
export function getActiveDbSync(): ActiveDb | null {
  return cached?.state ?? null;
}

/** Switch the app to a freshly rotated DB. */
export async function publishDbState(state: ActiveDb): Promise<void> {
  if (!blobConfigured()) return;
  await put(POINTER_PATH, JSON.stringify(state), {
    access: "public",
    contentType: "application/json",
    cacheControlMaxAge: 60,
    allowOverwrite: true,
    token: getBlobToken(),
  });
}

/**
 * Exclusive rotation lock. put() without allowOverwrite throws if the blob
 * exists → atomic unique-create; stale (>10min) locks are taken over.
 */
export async function tryAcquireLock(): Promise<{ ok: true; token: string } | { ok: false; reason: string }> {
  if (!blobConfigured()) return { ok: true, token: "local-noop" };
  const token = crypto.randomUUID();
  try {
    await put(LOCK_PATH, JSON.stringify({ startedAt: new Date().toISOString(), token }), {
      access: "public",
      contentType: "application/json",
      cacheControlMaxAge: 60,
      token: getBlobToken(),
    });
    return { ok: true, token };
  } catch {
    // Lock exists — stale takeover or concurrent rotation in flight.
    const lock = (await readBlob(LOCK_PATH)) as { startedAt: string } | null;
    if (!lock) return { ok: true, token }; // vanished mid-check; ours now
    if (Date.now() - new Date(lock.startedAt).getTime() > LOCK_TTL_MS) {
      await del(LOCK_PATH, { token: getBlobToken() }).catch(() => {});
      return tryAcquireLock();
    }
    return { ok: false, reason: "rotation already in progress (blob lock held)" };
  }
}

export async function releaseLock(): Promise<void> {
  if (!blobConfigured()) return;
  await del(LOCK_PATH, { token: getBlobToken() }).catch(() => {});
}