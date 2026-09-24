import { NextResponse } from "next/server";
import { rotateDb } from "../../../../../scripts/rotate-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // rotation = create + migrate + copy; keep under 5min

const UNAUTHORIZED = NextResponse.json({ error: "unauthorized" }, { status: 401 });

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  // Vercel Cron sends `Authorization: Bearer $CRON_SECRET`; manual runs must too.
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return UNAUTHORIZED;
  }
  try {
    return NextResponse.json(await rotateDb({ force: false }));
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "rotation failed" },
      { status: 500 }
    );
  }
}