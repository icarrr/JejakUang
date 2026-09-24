/**
 * Provision a dev database via neon.new Claimable Postgres (72h ephemeral),
 * write DATABASE_URL to .env.local (replace, never accumulate), and run Drizzle migrations.
 * Usage: npm run db:provision
 */
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { migrate } from "drizzle-orm/neon-http/migrator";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../src/db/schema";

/** Lines owned by the provision flow; any count of them is normalized away. */
const MANAGED_PREFIXES = [
  "DATABASE_URL=",
  "DATABASE_URL_DIRECT=",
  "PUBLIC_POSTGRES_CLAIM_URL=",
  "# Claimable DB expires at:",
  "# Claim it now:",
  "# Claim it now to your account using the link below:",
];

/**
 * Rewrite .env.local: strip all managed lines, then append fresh values.
 * Non-managed keys (AUTH_SECRET, user vars) are preserved as-is.
 */
function persistEnv(
  envPath: string,
  values: { databaseUrl: string; claimUrl: string; claimExpiresAt: Date }
) {
  const existing = readFileSync(envPath, "utf8");
  const kept = existing
    .split("\n")
    .filter((l) => !MANAGED_PREFIXES.some((p) => l.startsWith(p)))
    .join("\n")
    .replace(/\n{2,}/g, "\n")
    .replace(/\n+$/, "");

  const block = [
    "",
    `DATABASE_URL=${values.databaseUrl}`,
    `# Claimable DB expires at: ${values.claimExpiresAt.toISOString()}`,
    `# Claim it now: ${values.claimUrl}`,
    "",
  ];

  // Ensure NextAuth secret exists (generate once, preserved on re-runs).
  if (!kept.split("\n").some((l) => l.startsWith("AUTH_SECRET="))) {
    const secretLine = `AUTH_SECRET=${randomBytes(32).toString("base64")}`;
    const withSecret = `${kept}${kept ? "\n" : ""}${secretLine}\n`;
    writeFileSync(envPath, `${withSecret}${block.join("\n")}`);
    console.log("AUTH_SECRET generated in .env.local");
    return;
  }

  writeFileSync(envPath, `${kept}${block.join("\n")}`);
}

async function main() {
  // neon-new ships ESM-only exports; dynamic import avoids CJS resolution issues.
  const { instantPostgres } = await import("neon-new");

  console.log("Creating ephemeral Postgres (Claimable Postgres by Neon)…");
  const { databaseUrl, claimUrl, claimExpiresAt } = await instantPostgres({
    referrer: "npm:jejakuang|dev",
    dotEnvFile: ".env.local",
    dotEnvKey: "DATABASE_URL",
  });

  persistEnv(".env.local", { databaseUrl, claimUrl, claimExpiresAt });
  console.log("DATABASE_URL replaced in .env.local (no duplicates).");

  // Run migrations (0000 + 0001 = full schema)
  const sql = neon(databaseUrl);
  const db = drizzle(sql, { schema });
  console.log("Running migrations…");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations applied.");

  console.log(`claim_url: ${claimUrl}`);
  console.log(`expires_at: ${claimExpiresAt}`);
  console.log("Done. DB is ready for dev.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});