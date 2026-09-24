import { and, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { categories, moneyAccounts, transactions } from "@/db/schema";
import { formatRp } from "@/lib/format";
import { monthsBetween, prevRange, type DateRange } from "@/lib/date-range";

const CASH_TYPES = ["INCOME", "EXPENSE"] as const;
const monthExpr = sql<string>`to_char(date_trunc('month', ${transactions.transactionDate}), 'YYYY-MM')`;

/* ── Period metrics ─────────────────────────────────────────────── */

export type PeriodMetrics = { income: number; expense: number; net: number };

async function periodMetricsByRange(userId: string, range: DateRange): Promise<PeriodMetrics> {
  const rows = await db
    .select({ type: transactions.type, total: sql<number>`sum(${transactions.amount})` })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        inArray(transactions.type, CASH_TYPES),
        gte(transactions.transactionDate, range.from),
        lt(transactions.transactionDate, range.to)
      )
    )
    .groupBy(transactions.type);
  let income = 0;
  let expense = 0;
  for (const r of rows) {
    if (r.type === "INCOME") income = Number(r.total);
    else expense = Number(r.total);
  }
  return { income, expense, net: income - expense };
}

/** Pure: absolute + percent deltas, pct null when prev is 0. */
export function comparePeriods(cur: PeriodMetrics, prev: PeriodMetrics) {
  const pct = (a: number, b: number) => (b === 0 ? null : Math.round(((a - b) / b) * 100));
  return {
    incomeDiff: cur.income - prev.income,
    incomePct: pct(cur.income, prev.income),
    expenseDiff: cur.expense - prev.expense,
    expensePct: pct(cur.expense, prev.expense),
    netDiff: cur.net - prev.net,
    netPct: pct(cur.net, prev.net),
  };
}

/** Cur vs previous equal-length period metrics. */
export async function periodCompare(userId: string, range: DateRange) {
  const [cur, prev] = await Promise.all([
    periodMetricsByRange(userId, range),
    periodMetricsByRange(userId, prevRange(range)),
  ]);
  return { cur, prev, diffs: comparePeriods(cur, prev) };
}

/* ── Cash flow series (income / expense / net per month) ────────── */

export type MonthPoint = { month: string; income: number; expense: number; net: number };

export async function cashFlowSeries(userId: string, range: DateRange): Promise<MonthPoint[]> {
  const rows = await db
    .select({ month: monthExpr, type: transactions.type, total: sql<number>`sum(${transactions.amount})` })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        inArray(transactions.type, CASH_TYPES),
        gte(transactions.transactionDate, range.from),
        lt(transactions.transactionDate, range.to)
      )
    )
    .groupBy(monthExpr, transactions.type);

  const keys = monthsBetween(range);
  const byMonth = new Map(keys.map((k) => [k, { income: 0, expense: 0 }]));
  for (const r of rows) {
    const m = byMonth.get(r.month);
    if (!m) continue;
    if (r.type === "INCOME") m.income += Number(r.total);
    else m.expense += Number(r.total);
  }
  return keys.map((month) => {
    const m = byMonth.get(month)!;
    return { month, income: m.income, expense: m.expense, net: m.income - m.expense };
  });
}

/* ── Expense by category (SQL GROUP BY) ─────────────────────────── */

export type CategoryTotal = { categoryId: string; name: string; icon: string; total: number };

export async function expenseByCategoryMap(userId: string, range: DateRange): Promise<Map<string, CategoryTotal>> {
  const rows = await db
    .select({
      categoryId: transactions.categoryId,
      name: categories.name,
      icon: categories.icon,
      total: sql<number>`sum(${transactions.amount})`,
    })
    .from(transactions)
    .innerJoin(categories, eq(categories.id, transactions.categoryId))
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.type, "EXPENSE"),
        gte(transactions.transactionDate, range.from),
        lt(transactions.transactionDate, range.to)
      )
    )
    .groupBy(transactions.categoryId, categories.name, categories.icon)
    .orderBy(sql`sum(${transactions.amount}) desc`);

  const m = new Map<string, CategoryTotal>();
  for (const r of rows) {
    if (r.categoryId && r.name) m.set(r.categoryId, { categoryId: r.categoryId, name: r.name, icon: r.icon ?? "", total: Number(r.total) });
  }
  return m;
}

/* ── Category trend across months (top N) ───────────────────────── */

export type CategoryTrend = {
  months: string[];
  categories: Array<{ id: string; name: string; icon: string; total: number }>;
  data: number[][];
};

export async function categoryTrend(
  userId: string,
  range: DateRange,
  catTotals: Map<string, CategoryTotal>,
  topN = 4
): Promise<CategoryTrend> {
  const top = [...catTotals.values()].sort((a, b) => b.total - a.total).slice(0, topN);
  if (top.length === 0) return { months: [], categories: [], data: [] };

  const topIds = top.map((c) => c.categoryId);
  const rows = await db
    .select({ categoryId: transactions.categoryId, month: monthExpr, total: sql<number>`sum(${transactions.amount})` })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.type, "EXPENSE"),
        inArray(transactions.categoryId, topIds),
        gte(transactions.transactionDate, range.from),
        lt(transactions.transactionDate, range.to)
      )
    )
    .groupBy(transactions.categoryId, monthExpr);

  const months = monthsBetween(range);
  const cell = new Map<string, Map<string, number>>(topIds.map((id) => [id, new Map()]));
  for (const r of rows) {
    if (!r.categoryId) continue;
    cell.get(r.categoryId)?.set(r.month, Number(r.total));
  }
  return {
    months,
    categories: top.map((c) => ({ id: c.categoryId, name: c.name, icon: c.icon, total: c.total })),
    data: top.map((c) => months.map((m) => cell.get(c.categoryId)?.get(m) ?? 0)),
  };
}

/* ── Daily spending pattern (per day of week) ───────────────────── */

export const WEEKDAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

export async function dailyPattern(userId: string, range: DateRange): Promise<number[]> {
  const dowExpr = sql<number>`extract(isodow from ${transactions.transactionDate})`;
  const rows = await db
    .select({ dow: dowExpr, total: sql<number>`sum(${transactions.amount})` })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.type, "EXPENSE"),
        gte(transactions.transactionDate, range.from),
        lt(transactions.transactionDate, range.to)
      )
    )
    .groupBy(dowExpr);
  const totals = WEEKDAYS.map(() => 0);
  for (const r of rows) {
    if (r.dow >= 1 && r.dow <= 7) totals[r.dow - 1] += Number(r.total);
  }
  return totals;
}

/* ── Where did my money go + largest expenses ───────────────────── */

export type SampleTx = {
  id: string;
  description: string;
  amount: number;
  transactionDate: Date;
  accountName: string;
};

export type WhereMoneyWent = {
  breakdown: Array<CategoryTotal & { pct: number; count: number; samples: SampleTx[] }>;
  largest: SampleTx[];
};

export async function whereMoneyWent(userId: string, range: DateRange, topN = 5): Promise<WhereMoneyWent> {
  const rows = await db
    .select({
      id: transactions.id,
      categoryId: transactions.categoryId,
      name: categories.name,
      icon: categories.icon,
      amount: transactions.amount,
      description: transactions.description,
      transactionDate: transactions.transactionDate,
      accountName: moneyAccounts.name,
    })
    .from(transactions)
    .innerJoin(moneyAccounts, eq(moneyAccounts.id, transactions.accountId))
    .leftJoin(categories, eq(categories.id, transactions.categoryId))
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.type, "EXPENSE"),
        gte(transactions.transactionDate, range.from),
        lt(transactions.transactionDate, range.to)
      )
    )
    .orderBy(desc(transactions.amount));

  const groups = new Map<string, { categoryId: string; name: string; icon: string; total: number; count: number; samples: SampleTx[] }>();
  let grandTotal = 0;
  for (const r of rows) {
    grandTotal += r.amount;
    const key = r.categoryId || "__uncat__";
    const g = groups.get(key) ?? {
      categoryId: key,
      name: r.name ?? "Tanpa Kategori",
      icon: r.icon ?? "🏷️",
      total: 0,
      count: 0,
      samples: [],
    };
    g.total += r.amount;
    g.count += 1;
    if (g.samples.length < 3) {
      g.samples.push({ id: r.id, description: r.description, amount: r.amount, transactionDate: r.transactionDate, accountName: r.accountName });
    }
    groups.set(key, g);
  }

  const breakdown = [...groups.values()]
    .map((g) => ({ ...g, pct: grandTotal > 0 ? Math.round((g.total / grandTotal) * 100) : 0 }))
    .sort((a, b) => b.total - a.total)
    .slice(0, topN);

  const largest = rows.slice(0, 8).map((r) => ({
    id: r.id,
    description: r.description,
    amount: r.amount,
    transactionDate: r.transactionDate,
    accountName: r.accountName,
  }));

  return { breakdown, largest };
}

/* ── Financial insights (rule engine, pure) ─────────────────────── */

export type InsightInput = {
  cur: PeriodMetrics;
  prev: PeriodMetrics;
  topCategory: { name: string; total: number } | null;
  unit: string;
  unitPrev: string;
};

/**
 * Factual, non-judgmental insights derived purely from data.
 * Rules per INSIGHTFUL.md #9: income delta, expense delta, top category,
 * net cash flow sign, no-data.
 */
export function buildInsights(i: InsightInput): string[] {
  const { cur, prev, topCategory, unit, unitPrev } = i;
  if (cur.income === 0 && cur.expense === 0) {
    return ["Belum cukup data untuk membuat insight. Mulai catat transaksi untuk melihat pola keuanganmu."];
  }
  const out: string[] = [];
  const hasPrev = prev.income > 0 || prev.expense > 0;
  if (hasPrev) {
    const pct = (a: number, b: number) => (b === 0 ? null : Math.round(((a - b) / b) * 100));
    const deltaLine = (label: string, curV: number, prevV: number) => {
      if (curV === prevV) return null;
      const diff = Math.abs(curV - prevV);
      const p = pct(curV, prevV);
      const pctTxt = p != null && p !== 0 && Math.abs(p) <= 999 ? ` (${p}%)` : "";
      return `${label} ${curV > prevV ? "naik" : "turun"} ${formatRp(diff)}${pctTxt} dibanding ${unitPrev}.`;
    };
    const l = deltaLine("Pemasukan", cur.income, prev.income);
    if (l) out.push(l);
    const e = deltaLine("Pengeluaran", cur.expense, prev.expense);
    if (e && e !== l) out.push(e);
  }
  if (topCategory && topCategory.total > 0) {
    out.push(`${topCategory.name} menjadi kategori pengeluaran terbesar ${unit} dengan ${formatRp(topCategory.total)}.`);
  }
  if (cur.net > 0) out.push(`Net cash flow ${unit} positif ${formatRp(cur.net)}.`);
  else if (cur.net < 0) out.push(`Pengeluaran ${unit} lebih besar daripada pemasukan sebesar ${formatRp(-cur.net)}.`);
  return out.slice(0, 5);
}

/* ── Account distribution (reuses balance engine) ───────────────── */

export { getBalances as accountDistribution } from "@/lib/balance";

/* convenience, exported for the self-check */
export { monthsBetween, prevRange } from "@/lib/date-range";