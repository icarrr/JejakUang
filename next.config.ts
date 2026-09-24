import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // drizzle migrate() reads ./drizzle at runtime; Next must trace those files
  // into the rotation function's bundle (vercel.json includeFiles doesn't
  // apply to Next App Router routes).
  outputFileTracingIncludes: {
    "/api/cron/rotate-db": ["./drizzle/**/*"],
  },
};

export default nextConfig;
