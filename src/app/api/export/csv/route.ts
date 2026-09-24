import { auth } from "@/auth";
import { transactionsInMonth } from "@/lib/reports";

export const dynamic = "force-dynamic";

const HEADERS = "Tanggal,Tipe,Deskripsi,Akun,Kategori,Kontak,Nominal,Catatan";

function csvCell(v: string | number | null | undefined): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month") ?? "";
  if (!/^\d{4}-\d{2}$/.test(month)) return new Response("Bulan tidak valid", { status: 400 });

  const rows = await transactionsInMonth(session.user.id, month);

  const lines = rows.map((r) =>
    [
      r.transactionDate.toISOString().slice(0, 10),
      r.type,
      csvCell(r.description),
      csvCell(r.accountName),
      csvCell(r.categoryName),
      csvCell(r.contactName),
      r.type === "EXPENSE" || r.type === "LOAN_GIVEN" || r.type === "DEBT_PAYMENT"
        ? `-${r.amount}`
        : String(r.amount),
      csvCell(r.notes),
    ].join(",")
  );

  const csv = [HEADERS, ...lines].join("\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="jejakuang-${month}.csv"`,
    },
  });
}