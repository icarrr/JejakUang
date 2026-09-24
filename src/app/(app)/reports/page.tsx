import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { budgets, categories } from "@/db/schema";
import { requireUser } from "@/lib/require-user";
import {
  expenseByAccount,
  expenseByCategory,
  monthlyComparison,
  monthlyReport,
  monthlyTrend,
} from "@/lib/reports";
import { formatRp, monthKey, monthLabel } from "@/lib/format";
import { BudgetSection } from "@/components/budget-forms";

export const dynamic = "force-dynamic";

const PALETTE = ["#059669", "#0d9488", "#0284c7", "#7c3aed", "#db2777", "#ea580c", "#ca8a04", "#64748b"];

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const userId = await requireUser();
  const { m } = await searchParams;
  const month = m && /^\d{4}-\d{2}$/.test(m) ? m : monthKey(new Date());
  const [y, mo] = month.split("-").map(Number);
  const prevKey = monthKey(new Date(y, mo - 2, 1));
  const isCurrentMonth = month === monthKey(new Date());

  const [report, comp, byAccount, byCatExpense, trend, monthBudgets, expenseCats] = await Promise.all([
    monthlyReport(userId, month),
    monthlyComparison(userId, month),
    expenseByAccount(userId, month),
    expenseByCategory(userId, month),
    monthlyTrend(userId, 6),
    db.query.budgets.findMany({
      where: and(eq(budgets.userId, userId), eq(budgets.month, month)),
      orderBy: [asc(budgets.categoryId)],
    }),
    db.query.categories.findMany({
      where: eq(categories.userId, userId),
      orderBy: [asc(categories.name)],
    }),
  ]);

  const catById = new Map(expenseCats.map((c) => [c.id, c]));
  const budgetRows = monthBudgets
    .filter((b) => catById.has(b.categoryId))
    .map((b) => {
      const c = catById.get(b.categoryId)!;
      return {
        id: b.id,
        categoryId: b.categoryId,
        categoryName: c.name,
        icon: c.icon,
        amount: b.amount,
        used: byCatExpense.get(b.categoryId) ?? 0,
      };
    });

  const catBreakdown = expenseCats
    .map((c) => ({ category: c, total: byCatExpense.get(c.id) ?? 0 }))
    .filter((x) => x.total > 0)
    .sort((a, b) => b.total - a.total);
  const totalExpense = catBreakdown.reduce((a, x) => a + x.total, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Laporan</h1>
        <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-2 py-1 text-sm">
          <a href={`/reports?m=${prevKey}`} className="rounded px-2 py-1 hover:bg-neutral-100" aria-label="Bulan sebelumnya">
            ‹
          </a>
          <span className="min-w-32 text-center font-medium">{monthLabel(month)}</span>
          {!isCurrentMonth && (
            <a href="/reports" className="rounded px-2 py-1 hover:bg-neutral-100" aria-label="Bulan berjalan">
              ›
            </a>
          )}
        </div>
      </div>

      {/* Income / expense / net + comparison */}
      <section className="grid grid-cols-3 gap-3">
        <Card label="Pemasukan" value={`+${formatRp(report.income)}`} positive delta={comp.incomeDelta} />
        <Card label="Pengeluaran" value={`-${formatRp(report.expense)}`} negative delta={comp.expenseDelta} />
        <Card label="Net" value={formatRp(report.net)} delta={comp.netDelta} />
      </section>

      {/* Expense by category + donut */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-semibold">Pengeluaran per Kategori</h2>
          {catBreakdown.length === 0 ? (
            <p className="text-sm text-neutral-400">Belum ada pengeluaran bulan ini.</p>
          ) : (
            <>
              <Donut items={catBreakdown.map((x) => ({ label: x.category.name, value: x.total }))} />
              <ul className="mt-4 space-y-2">
                {catBreakdown.map((x, i) => (
                  <li key={x.category.id} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
                      {x.category.icon} {x.category.name}
                    </span>
                    <span className="font-semibold">{formatRp(x.total)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 border-t border-neutral-100 pt-2 text-xs text-neutral-400">
                {catBreakdown.length} kategori, total {formatRp(totalExpense)}
              </p>
            </>
          )}
        </div>

        {/* Expense by account */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-semibold">Pengeluaran per Akun</h2>
          {byAccount.length === 0 ? (
            <p className="text-sm text-neutral-400">Belum ada pengeluaran bulan ini.</p>
          ) : (
            <ul className="space-y-2">
              {byAccount.map((a) => (
                <li key={a.accountName} className="flex items-center justify-between text-sm">
                  <span className="font-medium">{a.accountName}</span>
                  <span className="font-semibold">{formatRp(a.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Trend chart */}
      <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-semibold">Tren 6 Bulan</h2>
        <TrendChart data={trend} />
      </section>

      {/* Budgets (PRD #37) */}
      <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-semibold">Anggaran · {monthLabel(month)}</h2>
        <BudgetSection
          month={month}
          budgets={budgetRows}
          categories={expenseCats
            .filter((c) => c.type === "EXPENSE")
            .map((c) => ({ id: c.id, name: c.name, icon: c.icon }))}
        />
      </section>

      {/* Export */}
      <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-semibold">Ekspor</h2>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/api/export/csv?month=${month}`}
            className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium hover:bg-neutral-50"
          >
            ⬇ Ekspor CSV ({monthLabel(month)})
          </a>
          <a
            href="/api/export/json"
            className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium hover:bg-neutral-50"
          >
            ⬇ Backup JSON (semua data)
          </a>
        </div>
        <p className="mt-2 text-xs text-neutral-400">
          CSV berisi transaksi bulan terpilih. Backup JSON berisi seluruh data akunmu.
        </p>
      </section>

      <p className="text-center text-sm">
        <Link href="/" className="font-medium text-emerald-700 hover:underline">
          ← Kembali ke Dashboard
        </Link>
      </p>
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
          {delta > 0 ? "▲" : delta < 0 ? "▼" : "•"} {Math.abs(delta)}%
        </p>
      )}
    </div>
  );
}

function Donut({ items }: { items: Array<{ label: string; value: number }> }) {
  const total = items.reduce((a, x) => a + x.value, 0);
  if (total === 0) return null;
  const R = 42;
  const C = 2 * Math.PI * R;
  const segments = items.map((x, i) => {
    const frac = x.value / total;
    const start = items.slice(0, i).reduce((a, y) => a + y.value / total, 0);
    return { key: x.label, frac, offset: start, color: PALETTE[i % PALETTE.length] };
  });
  return (
    <div className="flex items-center justify-center py-2">
      <svg viewBox="0 0 100 100" className="h-40 w-40 -rotate-90">
        <circle cx="50" cy="50" r={R} fill="none" stroke="#f5f5f5" strokeWidth="14" />
        {segments.map((s) => (
          <circle
            key={s.key}
            cx="50"
            cy="50"
            r={R}
            fill="none"
            stroke={s.color}
            strokeWidth="14"
            strokeDasharray={`${s.frac * C} ${C}`}
            strokeDashoffset={-s.offset * C}
          />
        ))}
      </svg>
    </div>
  );
}

function TrendChart({ data }: { data: Array<{ month: string; income: number; expense: number }> }) {
  const values = data.flatMap((d) => [d.income, d.expense]);
  const max = Math.max(...values, 1);
  const W = 280;
  const H = 120;
  const barW = 16;
  const gap = (W - data.length * barW * 2) / data.length;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H + 18}`} className="w-full max-w-md">
        {data.map((d, i) => {
          const x = i * (gap + barW * 2) + gap / 2;
          const incomeH = (d.income / max) * H;
          const expenseH = (d.expense / max) * H;
          return (
            <g key={d.month}>
              <rect x={x} y={H - incomeH} width={barW} height={incomeH} rx="2" fill="#059669" />
              <rect x={x + barW + 2} y={H - expenseH} width={barW} height={expenseH} rx="2" fill="#ef4444" />
              <text x={x + barW / 2} y={H + 12} fontSize="8" textAnchor="middle" fill="#a3a3a3">
                {d.month.slice(5)}/{d.month.slice(0, 4)}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="mt-2 flex gap-4 text-xs text-neutral-500">
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-600" /> Pemasukan
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-red-500" /> Pengeluaran
        </span>
      </div>
    </div>
  );
}