import { get } from "@vercel/blob";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { receipts } from "@/db/schema";

export const dynamic = "force-dynamic";

/**
 * Owner-only receipt stream. Blob store is private, so browser <img>/links
 * can't hit blob URLs directly — this route token-fetches and streams with
 * session + ownership checks (no IDOR: row must belong to the caller).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;

  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  const [receipt] = await db
    .select()
    .from(receipts)
    .where(and(eq(receipts.fileName, name), eq(receipts.userId, session.user.id)));
  if (!receipt) return new Response("Not found", { status: 404 });

  const token = process.env.STORAGE_BLOB_READ_WRITE_TOKEN ?? process.env.BLOB_READ_WRITE_TOKEN;
  const res = await get(receipt.fileName, { access: "private", token });
  if (!res?.stream) return new Response("Not found", { status: 404 });

  return new Response(res.stream as unknown as BodyInit, {
    headers: {
      "Content-Type": receipt.mimeType,
      "Content-Disposition": `inline; filename="${receipt.fileName}"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}