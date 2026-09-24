import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { contacts } from "@/db/schema";
import { getLoanSummary } from "@/lib/loans";
import { requireUser } from "@/lib/require-user";
import { formatRp } from "@/lib/format";
import { AddContactForm } from "@/components/contact-form";

export const dynamic = "force-dynamic";

export default async function LoansPage() {
  const userId = await requireUser();
  const [summary, userContacts] = await Promise.all([
    getLoanSummary(userId),
    db.query.contacts.findMany({
      where: eq(contacts.userId, userId),
      orderBy: [asc(contacts.name)],
      columns: { id: true, name: true, phone: true },
    }),
  ]);
  const hasLoans = summary.totalPiutang > 0 || summary.totalHutang > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Pinjaman</h1>
        <Link
          href="/transactions/new"
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
        >
          + Catat
        </Link>
      </div>

      {!hasLoans ? (
        <section className="rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
          <p className="text-4xl">🤝</p>
          <h2 className="mt-4 text-lg font-semibold">Belum ada pinjaman</h2>
          <p className="mx-auto mt-2 max-w-xs text-sm text-neutral-500">
            Catat uang yang kamu pinjamkan atau hutang yang kamu terima lewat tombol
            “Pinjamkan” atau “Bayar/Terima” saat mencatat transaksi.
          </p>
        </section>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold">Piutang</h2>
            <p className="text-xs text-neutral-400">Uang yang kamu pinjamkan ke orang lain</p>
            <ul className="mt-3 divide-y divide-neutral-100">
              {summary.piutang.map((p) => (
                <li key={p.contactName} className="flex min-w-0 items-center justify-between gap-3 py-2.5 text-sm">
                  <Link
                    href={`/transactions?q=${encodeURIComponent(p.contactName)}`}
                    className="min-w-0 truncate font-medium hover:underline"
                  >
                    {p.contactName}
                  </Link>
                  <span className="shrink-0 font-semibold text-emerald-700">{formatRp(p.remainingAmount)}</span>
                </li>
              ))}
              {summary.piutang.length === 0 && (
                <li className="py-2.5 text-sm text-neutral-400">Tidak ada.</li>
              )}
            </ul>
            <div className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-3">
              <span className="text-sm text-neutral-500">Total Piutang</span>
              <span className="font-bold">{formatRp(summary.totalPiutang)}</span>
            </div>
          </section>

          <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold">Hutang</h2>
            <p className="text-xs text-neutral-400">Uang yang kamu pinjam dari orang lain</p>
            <ul className="mt-3 divide-y divide-neutral-100">
              {summary.hutang.map((p) => (
                <li key={p.contactName} className="flex min-w-0 items-center justify-between gap-3 py-2.5 text-sm">
                  <Link
                    href={`/transactions?q=${encodeURIComponent(p.contactName)}`}
                    className="min-w-0 truncate font-medium hover:underline"
                  >
                    {p.contactName}
                  </Link>
                  <span className="shrink-0 font-semibold text-red-600">{formatRp(p.remainingAmount)}</span>
                </li>
              ))}
              {summary.hutang.length === 0 && (
                <li className="py-2.5 text-sm text-neutral-400">Tidak ada.</li>
              )}
            </ul>
            <div className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-3">
              <span className="text-sm text-neutral-500">Total Hutang</span>
              <span className="font-bold">{formatRp(summary.totalHutang)}</span>
            </div>
          </section>
        </div>
      )}

      <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-semibold">Kontak</h2>
        <AddContactForm />
        {userContacts.length > 0 && (
          <ul className="mt-4 divide-y divide-neutral-100">
            {userContacts.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-2 text-sm">
                <span className="font-medium">{c.name}</span>
                <span className="text-xs text-neutral-400">{c.phone || ""}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}