import Link from "next/link";
import { getBalances } from "@/lib/balance";
import { monthlyReport, monthlyComparison, recentTransactions } from "@/lib/reports";
import { requireUser } from "@/lib/require-user";
import { formatRp, monthKey, monthLabel, dateLabel } from "@/lib/format";
import { TxSign } from "@/components/tx";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const userId = await requireUser();
  const { m } = await searchParams;
  const month = m && /^\d{4}-\d{2}$/.test(m) ? m : monthKey(new Date());
  const [year, mon] = month.split("-").map(Number);

  const [balances, report, comparison, recent] = await Promise.all([
    getBalances(userId),
    monthlyReport(userId, month),
    monthlyComparison(userId, month),
    recentTransactions(userId, 10),
  ]);
  const hasAccounts = balances.accounts.length > 0;
  const hasTransactions =
    report.income > 0 || report.expense > 0 || recent.length > 0;

  const prevMonth = monthKey(new Date(year, mon - 2, 1));
  const nextMonth = monthKey(new Date(year, mon, 1));
  const isCurrentMonth = month === monthKey(new Date());

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-2 py-1 text-sm">
          <a
            href={`/?m=${prevMonth}`}
            className="rounded px-2 py-1 hover:bg-neutral-100"
            aria-label="Bulan sebelumnya"
          >
            ‹
          </a>
          <span className="min-w-32 text-center font-medium">{monthLabel(month)}</span>
          <a
            href={`/?m=${nextMonth}`}
            aria-disabled={isCurrentMonth}
            className={`rounded px-2 py-1 ${
              isCurrentMonth ? "pointer-events-none text-neutral-300" : "hover:bg-neutral-100"
            }`}
            aria-label="Bulan berikutnya"
          >
            ›
          </a>
        </div>
      </div>

      {!hasAccounts ? (
        <EmptyAccounts />
      ) : (
        <>
          {/* Total balance — active accounts only (PRD #26) */}
          <section className="rounded-2xl bg-emerald-700 p-6 text-white shadow-sm">
            <p className="text-sm text-emerald-100">Total Saldo</p>
            <p className="mt-1 text-3xl font-bold">{formatRp(balances.totalActiveBalance)}</p>
            <p className="mt-4 text-sm text-emerald-200">
              {balances.accounts.filter((a) => a.isActive).length} akun aktif
            </p>
          </section>

          {/* Income / Expense / Net + comparison vs prev month */}
          <section className="grid grid-cols-3 gap-3">
            <Card label="Pemasukan" value={`+${formatRp(report.income)}`} positive delta={comparison.incomeDelta} />
            <Card label="Pengeluaran" value={`-${formatRp(report.expense)}`} negative delta={comparison.expenseDelta} />
            <Card label="Selisih" value={formatRp(report.net)} delta={comparison.netDelta} />
          </section>

          {/* Top categories */}
          <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 font-semibold">
              Pengeluaran Terbesar{!isCurrentMonth ? ` · ${monthLabel(month)}` : ""}
            </h2>
            {report.topCategories.length === 0 ? (
              <p className="text-sm text-neutral-400">Belum ada pengeluaran bulan ini.</p>
            ) : (
              <ul className="space-y-3">
                {report.topCategories.map((c) => {
                  const pct = report.expense ? Math.round((c.total / report.expense) * 100) : 0;
                  return (
                    <li key={c.name}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <span>{c.icon}</span>
                          {c.name}
                        </span>
                        <span className="font-semibold">{formatRp(c.total)}</span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-neutral-100">
                        <div
                          className="h-1.5 rounded-full bg-emerald-600"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Recent transactions — global, last 10 (PRD #26) */}
          <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">Transaksi Terbaru</h2>
              <Link href="/transactions" className="text-sm font-medium text-emerald-700 hover:underline">
                Lihat semua
              </Link>
            </div>
            {!hasTransactions ? (
              <EmptyTransactions />
            ) : recent.length === 0 ? (
              <p className="text-sm text-neutral-400">Tidak ada transaksi.</p>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {recent.map((t) => (
                  <li key={t.id}>
                    <Link
                      href={`/transactions/${t.id}`}
                      className="flex items-center justify-between gap-3 py-3 hover:bg-neutral-50"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {t.description || t.categoryName || t.contactName || "Transaksi"}
                        </p>
                        <p className="text-xs text-neutral-400">
                          {dateLabel(t.transactionDate)} · {t.accountName}
                          {t.categoryName ? ` · ${t.categoryName}` : ""}
                          {t.contactName ? ` · ${t.contactName}` : ""}
                        </p>
                      </div>
                      <TxSign type={t.type} amount={t.amount} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <p className="text-center text-sm">
            <Link href="/reports" className="font-medium text-emerald-700 hover:underline">
              Lihat laporan lengkap & anggaran →
            </Link>
          </p>
        </>
      )}
    </div>
  );
}

function Card({
  label,
  value,
  positive,
  negative,
  delta,
}: {
  label: string;
  value: string;
  positive?: boolean;
  negative?: boolean;
  delta?: number | null;
}) {
  const color = positive ? "text-emerald-600" : negative ? "text-red-600" : "text-neutral-900";
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className={`mt-1 truncate text-sm font-bold sm:text-base ${color}`}>{value}</p>
      {delta != null && (
        <p className={`mt-0.5 text-xs ${delta > 0 ? "text-emerald-600" : delta < 0 ? "text-red-600" : "text-neutral-400"}`}>
          {delta > 0 ? "▲" : delta < 0 ? "▼" : "•"} {Math.abs(delta)}% vs bulan lalu
        </p>
      )}
    </div>
  );
}

function EmptyAccounts() {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
      <p className="text-4xl">👛</p>
      <h2 className="mt-4 text-lg font-semibold">Tambahkan akun pertamamu</h2>
      <p className="mx-auto mt-2 max-w-xs text-sm text-neutral-500">
        Contoh: BCA, Cash, GoPay. Saldo akun akan menjadi titik awal pencatatanmu.
      </p>
      <Link
        href="/accounts"
        className="mt-6 inline-block rounded-lg bg-emerald-700 px-5 py-2.5 font-semibold text-white hover:bg-emerald-800"
      >
        + Tambah Akun
      </Link>
    </section>
  );
}

function EmptyTransactions() {
  return (
    <p className="py-4 text-sm text-neutral-400">
      Belum ada transaksi. Mulai catat pengeluaran pertamamu untuk mengetahui uangmu pergi ke mana.
    </p>
  );
}