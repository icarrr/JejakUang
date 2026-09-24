import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { moneyAccounts, transactions, transfers } from "@/db/schema";

/** All system transaction types (PRD #12). */
export type TxType =
  | "INCOME"
  | "EXPENSE"
  | "TRANSFER"
  | "LOAN_GIVEN"
  | "LOAN_REPAYMENT"
  | "DEBT_RECEIVED"
  | "DEBT_PAYMENT";

export type AccountBalance = {
  id: string;
  name: string;
  type: (typeof moneyAccounts.$inferSelect)["type"];
  initialBalance: number;
  isActive: boolean;
  balance: number;
};

export type TxRow = { id: string; accountId: string; type: TxType; amount: number };

/**
 * PURE: balance per account derived from transactions (#10, #43).
 * INCOME +, EXPENSE -, TRANSFER source -/dest +,
 * LOAN_GIVEN - (account), LOAN_REPAYMENT +, DEBT_RECEIVED +, DEBT_PAYMENT -.
 */
export function computeBalances(
  accounts: Array<{ id: string; initialBalance: number }>,
  txns: TxRow[],
  transferRows: Array<{ transactionId: string; destinationAccountId: string }>
): Map<string, number> {
  const destByTx = new Map(transferRows.map((r) => [r.transactionId, r.destinationAccountId]));
  const transferIds = new Set(transferRows.map((r) => r.transactionId));

  const effect = new Map<string, number>();
  const add = (accountId: string, delta: number) =>
    effect.set(accountId, (effect.get(accountId) ?? 0) + delta);

  const debit: Partial<Record<TxType, number>> = {
    EXPENSE: -1,
    LOAN_GIVEN: -1,
    DEBT_PAYMENT: -1,
  };
  const credit: Partial<Record<TxType, number>> = {
    INCOME: 1,
    LOAN_REPAYMENT: 1,
    DEBT_RECEIVED: 1,
  };

  for (const t of txns) {
    if (t.type === "TRANSFER" && transferIds.has(t.id)) {
      add(t.accountId, -t.amount); // source
      const dest = destByTx.get(t.id);
      if (dest) add(dest, t.amount); // destination
      continue;
    }
    const d = debit[t.type] ?? 0;
    const c = credit[t.type] ?? 0;
    if (d || c) add(t.accountId, d * t.amount + c * t.amount);
  }

  const result = new Map<string, number>();
  for (const a of accounts) result.set(a.id, a.initialBalance + (effect.get(a.id) ?? 0));
  return result;
}

/** Balance per account + totals, derived from transactions. */
export async function getBalances(userId: string): Promise<{
  accounts: AccountBalance[];
  totalBalance: number;
  totalActiveBalance: number;
}> {
  const accounts =
    (await db.query.moneyAccounts.findMany({
      where: eq(moneyAccounts.userId, userId),
      orderBy: [asc(moneyAccounts.createdAt)],
    })) ?? [];

  const txns: TxRow[] =
    (await db
      .select({
        id: transactions.id,
        accountId: transactions.accountId,
        type: transactions.type,
        amount: transactions.amount,
      })
      .from(transactions)
      .where(eq(transactions.userId, userId))) ?? [];

  const transferRows =
    (await db
      .select({
        transactionId: transfers.transactionId,
        destinationAccountId: transfers.destinationAccountId,
      })
      .from(transfers)
      .where(eq(transfers.userId, userId))) ?? [];

  const balances = computeBalances(accounts, txns, transferRows);

  let totalBalance = 0;
  let totalActiveBalance = 0;
  const result = accounts.map((a) => {
    const balance = balances.get(a.id) ?? a.initialBalance;
    totalBalance += balance;
    if (a.isActive) totalActiveBalance += balance;
    return { ...a, balance };
  });
  return { accounts: result, totalBalance, totalActiveBalance };
}

/** Single account balance (used by transaction forms to preview). */
export async function getAccountBalance(userId: string, accountId: string) {
  const all = await getBalances(userId);
  return all.accounts.find((a) => a.id === accountId)?.balance ?? 0;
}