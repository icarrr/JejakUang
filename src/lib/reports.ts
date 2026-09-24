import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { categories, contacts, moneyAccounts, transactions } from "@/db/schema";
import { monthKey } from "@/lib/format";

export type MonthlyReport = {
  income: number;
  expense: number;
  net: number;
  topCategories: Array<{ name: string; icon: string; total: number }>;
  recent: Array<{
    id: string;
    type: "INCOME" | "EXPENSE" | "TRANSFER" | "LOAN_GIVEN" | "LOAN_REPAYMENT" | "DEBT_RECEIVED" | "DEBT_PAYMENT";
    amount: number;
    description: string;
    transactionDate: Date;
    accountName: string;
    categoryName: string | null;
    contactName: string | null;
  }>;
};

function monthBounds(month: string): { start: Date; end: Date } {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m || m < 1 || m > 12) throw new Error("Bulan tidak valid");
  return { start: new Date(y, m - 1, 1), end: new Date(y, m, 1) };
}

async function monthRows(userId: string, start: Date, end: Date) {
  return (
    (await db
      .select({
        id: transactions.id,
        type: transactions.type,
        amount: transactions.amount,
        description: transactions.description,
        transactionDate: transactions.transactionDate,
        categoryId: transactions.categoryId,
        accountId: transactions.accountId,
        accountName: moneyAccounts.name,
        categoryName: categories.name,
        categoryIcon: categories.icon,
        contactName: contacts.name,
        notes: transactions.notes,
      })
      .from(transactions)
      .innerJoin(moneyAccounts, eq(moneyAccounts.id, transactions.accountId))
      .leftJoin(categories, eq(categories.id, transactions.categoryId))
      .leftJoin(contacts, eq(contacts.id, transactions.contactId))
      .where(and(eq(transactions.userId, userId), gte(transactions.transactionDate, start), lt(transactions.transactionDate, end)))
      .orderBy(desc(transactions.transactionDate))) ?? []
  );
}

function summarize(rows: Awaited<ReturnType<typeof monthRows>>): MonthlyReport {
  let income = 0;
  let expense = 0;
  const catTotal = new Map<string, { name: string; icon: string; total: number }>();

  for (const r of rows) {
    if (r.type === "INCOME") income += r.amount;
    else if (r.type === "EXPENSE") {
      expense += r.amount;
      if (r.categoryId && r.categoryName) {
        const cur = catTotal.get(r.categoryId) ?? {
          name: r.categoryName,
          icon: r.categoryIcon ?? "",
          total: 0,
        };
        cur.total += r.amount;
        catTotal.set(r.categoryId, cur);
      }
    }
  }

  return {
    income,
    expense,
    net: income - expense,
    topCategories: [...catTotal.values()].sort((a, b) => b.total - a.total).slice(0, 5),
    recent: rows.slice(0, 10),
  };
}

/** Monthly aggregates: income, expense, net, top categories, recent txs. */
export async function monthlyReport(userId: string, month: string): Promise<MonthlyReport> {
  const { start, end } = monthBounds(month);
  const rows = await monthRows(userId, start, end);
  return summarize(rows);
}

/** Full transaction list for a month — used by CSV export (#65). */
export async function transactionsInMonth(userId: string, month: string) {
  const { start, end } = monthBounds(month);
  return monthRows(userId, start, end);
}

/** Global recent transactions (PRD #26: last N across all time). */
export async function recentTransactions(userId: string, limit = 10) {
  const rows = await monthRows(userId, new Date(0), new Date(2099, 11, 31));
  return rows.slice(0, limit);
}

/** Compare a month vs the previous month (PRD #65 monthly comparison). */
export async function monthlyComparison(userId: string, month: string) {
  const [y, m] = month.split("-").map(Number);
  const prevKey = monthKey(new Date(y, m - 2, 1));
  const [cur, prev] = await Promise.all([monthlyReport(userId, month), monthlyReport(userId, prevKey)]);
  const delta = (curVal: number, prevVal: number) =>
    prevVal === 0 ? null : Math.round(((curVal - prevVal) / prevVal) * 100);
  return {
    prevKey,
    incomeDelta: delta(cur.income, prev.income),
    expenseDelta: delta(cur.expense, prev.expense),
    netDelta: delta(cur.net, prev.net),
    prev: { income: prev.income, expense: prev.expense, net: prev.net },
  };
}

/** Expense grouped by account for a month (PRD #46 expense by account). */
export async function expenseByAccount(userId: string, month: string) {
  const { start, end } = monthBounds(month);
  const rows = await db
    .select({
      accountName: moneyAccounts.name,
      total: sql<number>`sum(${transactions.amount})`,
    })
    .from(transactions)
    .innerJoin(moneyAccounts, eq(moneyAccounts.id, transactions.accountId))
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.type, "EXPENSE"),
        gte(transactions.transactionDate, start),
        lt(transactions.transactionDate, end)
      )
    )
    .groupBy(moneyAccounts.name)
    .orderBy(sql`sum(${transactions.amount}) desc`);
  return rows;
}

/** Income vs expense for the last N months (chart data). */
export async function monthlyTrend(userId: string, months = 6) {
  const now = new Date();
  const keys: string[] = [];
  for (let i = months - 1; i >= 0; i--) keys.push(monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)));
  const reports = await Promise.all(keys.map((k) => monthlyReport(userId, k)));
  return keys.map((k, i) => ({ month: k, income: reports[i].income, expense: reports[i].expense }));
}

/** Expense per category for a month — used to compute budget usage (PRD #37). */
export async function expenseByCategory(userId: string, month: string) {
  const { start, end } = monthBounds(month);
  const rows = await db
    .select({ categoryId: transactions.categoryId, total: sql<number>`sum(${transactions.amount})` })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.type, "EXPENSE"),
        gte(transactions.transactionDate, start),
        lt(transactions.transactionDate, end)
      )
    )
    .groupBy(transactions.categoryId);
  return new Map(rows.filter((r) => r.categoryId).map((r) => [r.categoryId!, r.total]));
}