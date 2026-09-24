/**
 * Next.js instrumentation: runs once per serverless instance at cold start,
 * BEFORE any request is accepted. Pre-warms the active-DB pointer cache so
 * the first DB access is synchronous and never falls back to an unset
 * DATABASE_URL (production has no Vercel DATABASE_URL env — the blob
 * pointer / rotation flow owns it).
 */
import { getActiveDb } from "./src/lib/db-state";

export async function register() {
  await getActiveDb();
}