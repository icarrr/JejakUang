import Link from "next/link";
import { getBalances } from "@/lib/balance";
import { recentTransactions } from "@/lib/reports";
import { requireUser } from "@/lib/require-user";
import { formatRp, dateLabel } from "@/lib/format";
import {
  PRESETS,
  parseRange,
  rangeLabel,
  isSingleMonth,
  prevRange as prevRangeOf,
} from "@/lib/date-range";
import {
  cashFlowSeries,
  categoryTrend,
  dailyPattern,
  expenseByCategoryMap,
  periodCompare,
  whereMoneyWent,
  buildInsights,
  WEEKDAYS,
  type CategoryTotal,
} from "@/lib/insights";
import { LineChart, WeekdayBars, CASH_COLORS, PALETTE } from "@/components/charts";
import { TxSign } from "@/components/tx";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string; m?: string; from?: string; to?: string }>;
}) {
  const userId = await requireUser();
  const params = await searchParams;
  const range = parseRange(params);
  const singleMonth = isSingleMonth(range);
  const unit = singleMonth ? "bulan ini" : "periode ini";
  const unitPrev = singleMonth ? "bulan lalu" : "periode sebelumnya";

  const [balances, wmw, series, cmp, daily, prevCats, recent] = await Promise.all([
    getBalances(userId),
    whereMoneyWent(userId, range, 5),
    cashFlowSeries(userId, range),
    periodCompare(userId, range),
    dailyPattern(userId, range),
    expenseByCategoryMap(userId, prevRangeOf(range)),
    recentTransactions(userId, 10),
  ]);

  const catTotals = new Map<string, CategoryTotal>(
    wmw.breakdown.map((b) => [b.categoryId, { categoryId: b.categoryId, name: b.name, icon: b.icon, total: b.total }])
  );
  const trend = await categoryTrend(userId, range, catTotals, 4);

  const hasAccounts = balances.accounts.length > 0;
  const hasCashData = cmp.cur.income > 0 || cmp.cur.expense > 0;
  const insights = buildInsights({
    cur: cmp.cur,
    prev: cmp.prev,
    topCategory: wmw.breakdown[0] ? { name: wmw.breakdown[0].name, total: wmw.breakdown[0].total } : null,
    unit,
    unitPrev,
  });

  const monthShortLbl = (k: string) => {
    const [y, m] = k.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString("id-ID", { month: "short" }).replace(".", "");
  };
  const xLabels = series.map((s) => monthShortLbl(s.month));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <RangeSelector
          active={range.preset}
          from={range.from}
          to={new Date(range.to.getTime() - 86400000)}
        />
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

          {/* Income / Expense / Net Cash Flow, range summary */}
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Card label="Pemasukan" value={`+${formatRp(cmp.cur.income)}`} positive diff={cmp.diffs.incomeDiff} pct={cmp.diffs.incomePct} unitPrev={unitPrev} />
            <Card label="Pengeluaran" value={`-${formatRp(cmp.cur.expense)}`} negative diff={cmp.diffs.expenseDiff} pct={cmp.diffs.expensePct} unitPrev={unitPrev} />
            <Card label="Net Cash Flow" value={formatRp(cmp.cur.net)} diff={cmp.diffs.netDiff} pct={cmp.diffs.netPct} unitPrev={unitPrev} />
          </section>

          {/* Cash Flow Trend — income / expense / net line chart */}
          <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 font-semibold">Cash Flow Trend · {rangeLabel(range)}</h2>
            {hasCashData && series.some((s) => s.income > 0 || s.expense > 0) ? (
              <LineChart
                xLabels={xLabels}
                series={[
                  { name: "Pemasukan", color: CASH_COLORS.income, values: series.map((s) => s.income) },
                  { name: "Pengeluaran", color: CASH_COLORS.expense, values: series.map((s) => s.expense) },
                  { name: "Net", color: CASH_COLORS.net, values: series.map((s) => s.net) },
                ]}
              />
            ) : (
              <EmptyChart />
            )}
          </section>

          {/* Where money went (ranking + drill) | Account distribution */}
          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
              <h2 className="mb-3 font-semibold">Ke Mana Uangmu Pergi · {rangeLabel(range)}</h2>
              {wmw.breakdown.length === 0 ? (
                <EmptyChart />
              ) : (
                <ul className="space-y-3">
                  {wmw.breakdown.map((b) => (
                    <li key={b.categoryId}>
                      <details>
                        <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                          <div className="flex items-center justify-between text-sm">
                            <span className="flex items-center gap-2 font-medium">
                              <span>{b.icon}</span>
                              {b.name}
                              <span className="text-xs font-normal text-neutral-400">({b.count} tx)</span>
                            </span>
                            <span className="flex items-center gap-2">
                              <span className="font-semibold">{formatRp(b.total)}</span>
                              <span className="w-10 text-right text-xs text-neutral-400">{b.pct}%</span>
                            </span>
                          </div>
                          <div className="mt-1.5 h-1.5 rounded-full bg-neutral-100">
                            <div
                              className="h-1.5 rounded-full bg-emerald-600"
                              style={{ width: `${b.pct}%` }}
                            />
                          </div>
                        </summary>
                        <ul className="mt-2 divide-y divide-neutral-50 border-t border-neutral-100 pt-1">
                          {b.samples.map((t) => (
                            <li key={t.id}>
                              <Link
                                href={`/transactions/${t.id}`}
                                className="flex items-center justify-between gap-2 py-2 text-sm hover:bg-neutral-50"
                              >
                                <span className="min-w-0 truncate">
                                  {t.description || "Transaksi"}
                                  <span className="ml-2 text-xs text-neutral-400">{t.accountName}</span>
                                </span>
                                <span className="font-semibold text-red-600">-{formatRp(t.amount)}</span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </details>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
              <h2 className="mb-3 font-semibold">Saldo per Akun</h2>
              {balances.accounts.length === 0 ? (
                <p className="text-sm text-neutral-400">Belum ada akun.</p>
              ) : (
                <ul className="space-y-2.5">
                  {balances.accounts.map((a) => {
                    const pct = balances.totalBalance > 0 ? Math.round((a.balance / balances.totalBalance) * 100) : 0;
                    return (
                      <li key={a.id}>
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2">
                            <span className="font-medium">{a.name}</span>
                            {!a.isActive && <span className="text-xs text-neutral-400">nonaktif</span>}
                          </span>
                          <span className="flex items-center gap-2">
                            <span className="font-semibold">{formatRp(a.balance)}</span>
                            <span className="w-10 text-right text-xs text-neutral-400">{pct}%</span>
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 rounded-full bg-neutral-100">
                          <div
                            className={`h-1.5 rounded-full ${a.balance < 0 ? "bg-red-500" : "bg-emerald-600"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>

          {/* Spending trend by category — top 4 categories across months */}
          <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 font-semibold">Tren Pengeluaran per Kategori · {rangeLabel(range)}</h2>
            {trend.categories.length === 0 || !hasCashData ? (
              <EmptyChart />
            ) : (
              <LineChart
                xLabels={trend.months.map(monthShortLbl)}
                series={trend.categories.map((c, i) => ({
                  name: c.icon ? `${c.icon} ${c.name}` : c.name,
                  color: PALETTE[i % PALETTE.length],
                  values: trend.data[i],
                }))}
              />
            )}
          </section>

          {/* Monthly comparison — top categories, current vs previous period */}
          <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 font-semibold">Perbandingan per Kategori</h2>
            {wmw.breakdown.length === 0 ? (
              <EmptyChart />
            ) : (
              <ul className="divide-y divide-neutral-100">
                {wmw.breakdown.slice(0, 5).map((b) => {
                  const prevTotal = prevCats.get(b.categoryId)?.total ?? 0;
                  const delta = b.total - prevTotal;
                  const pct = prevTotal > 0 ? Math.round((delta / prevTotal) * 100) : null;
                  return (
                    <li key={b.categoryId} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                      <span className="flex items-center gap-2">
                        <span>{b.icon}</span>
                        {b.name}
                      </span>
                      <span className="flex items-center gap-3 text-xs">
                        {prevTotal > 0 && (
                          <span className="text-neutral-400">{formatRp(prevTotal)} →</span>
                        )}
                        <span className="font-semibold text-neutral-900">{formatRp(b.total)}</span>
                        {prevTotal === 0 ? (
                          <span className="w-24 text-right text-neutral-400">baru periode ini</span>
                        ) : (
                          <span
                            className={`w-32 text-right font-medium ${
                              delta > 0 ? "text-red-600" : delta < 0 ? "text-emerald-600" : "text-neutral-400"
                            }`}
                          >
                            {delta > 0 ? "+" : delta < 0 ? "-" : "•"}
                            {formatRp(Math.abs(delta))}
                            {pct != null && pct !== 0 ? ` (${pct}%)` : ""}
                          </span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Daily spending pattern */}
          <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 font-semibold">Pola Pengeluaran Harian · {rangeLabel(range)}</h2>
            {hasCashData && daily.some((d) => d > 0) ? (
              <WeekdayBars totals={daily} labels={WEEKDAYS} />
            ) : (
              <EmptyChart />
            )}
          </section>

          {/* Largest expenses */}
          <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 font-semibold">Pengeluaran Terbesar · {rangeLabel(range)}</h2>
            {wmw.largest.length === 0 ? (
              <EmptyChart />
            ) : (
              <ul className="divide-y divide-neutral-100">
                {wmw.largest.map((t) => (
                  <li key={t.id}>
                    <Link
                      href={`/transactions/${t.id}`}
                      className="flex items-center justify-between gap-3 py-3 hover:bg-neutral-50"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-red-600">
                          -{formatRp(t.amount)}
                        </span>
                        <span className="block truncate text-xs text-neutral-400">
                          {t.description || "Transaksi"} · {dateLabel(t.transactionDate)} · {t.accountName}
                        </span>
                      </span>
                      <span className="text-xs text-neutral-400">Lihat →</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Financial insights */}
          <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 font-semibold">Insights · {rangeLabel(range)}</h2>
            {!hasCashData ? (
              <EmptyChart />
            ) : (
              <ul className="space-y-2">
                {insights.map((s) => (
                  <li key={s} className="flex items-start gap-2 text-sm">
                    <span className="mt-1 text-emerald-600">◈</span>
                    <span>{s}</span>
                  </li>
                ))}
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
            {recent.length === 0 ? (
              <EmptyTransactions />
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

/* ── Range selector (server-rendered, no client state) ──────────── */

function RangeSelector({ active, from, to }: { active: string; from: Date; to: Date }) {
  const toInput = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-sm">
      {PRESETS.map((x) => (
        <a
          key={x.key}
          href={`/?p=${x.key}`}
          className={`rounded-lg px-3 py-1.5 font-medium ${
            active === x.key ? "bg-emerald-700 text-white" : "border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
          }`}
        >
          {x.label}
        </a>
      ))}
      <form
        action="/"
        method="get"
        className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 ${
          active === "custom" ? "border-emerald-600" : "border-neutral-200"
        }`}
      >
        <input
          type="date"
          name="from"
          defaultValue={toInput(from)}
          required
          aria-label="Dari tanggal"
          className="rounded border border-neutral-200 px-1.5 py-1 text-xs"
        />
        <span className="text-neutral-400">–</span>
        <input
          type="date"
          name="to"
          defaultValue={toInput(to)}
          required
          aria-label="Sampai tanggal"
          className="rounded border border-neutral-200 px-1.5 py-1 text-xs"
        />
        <button className="rounded bg-emerald-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-800">
          Terapkan
        </button>
      </form>
    </div>
  );
}

/* ── Shared pieces ──────────────────────────────────────────────── */

function Card({
  label,
  value,
  positive,
  negative,
  diff,
  pct,
  unitPrev,
}: {
  label: string;
  value: string;
  positive?: boolean;
  negative?: boolean;
  diff: number;
  pct: number | null;
  unitPrev: string;
}) {
  const color = positive ? "text-emerald-600" : negative ? "text-red-600" : "text-neutral-900";
  const deltaColor = diff > 0 ? "text-emerald-600" : diff < 0 ? "text-red-600" : "text-neutral-400";
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className={`mt-1 truncate text-sm font-bold sm:text-base ${color}`}>{value}</p>
      {diff !== 0 && (
        <p className={`mt-0.5 text-xs ${deltaColor}`}>
          {diff > 0 ? "▲" : "▼"} {formatRp(Math.abs(diff))}
          {pct != null && pct !== 0 ? ` (${Math.abs(pct)}%)` : ""} vs {unitPrev}
        </p>
      )}
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="py-6 text-center">
      <p className="text-sm font-medium text-neutral-500">Belum ada cukup transaksi</p>
      <p className="mx-auto mt-1 max-w-xs text-xs text-neutral-400">
        Mulai catat pemasukan dan pengeluaran untuk melihat pola keuanganmu di sini.
      </p>
      <Link
        href="/transactions/new"
        className="mt-4 inline-block rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
      >
        + Catat Transaksi
      </Link>
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