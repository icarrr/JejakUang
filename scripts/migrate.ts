/**
 * Apply Drizzle migrations to the configured DB (.env.local DATABASE_URL).
 * Why this exists: drizzle-kit ignores .env.local, so the plain script kept
 * failing with an empty url unless DATABASE_URL was exported by hand.
 * Usage: npm run db:migrate
 */
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";
import * as schema from "../src/db/schema";

async function main() {
  const url = process.env.DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED;
  if (!url) throw new Error("DATABASE_URL not set — check .env.local");
  await migrate(drizzle(neon(url), { schema }), { migrationsFolder: "./drizzle" });
  console.log("Migrations applied.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});