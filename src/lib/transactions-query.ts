import { and, desc, eq, gte, lte, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { categories, contacts, moneyAccounts, receipts, transactions, transfers } from "@/db/schema";
import type { TxType } from "@/lib/balance";

export type TxListItem = {
  id: string;
  type: TxType;
  amount: number;
  description: string;
  notes: string | null;
  transactionDate: Date;
  accountId: string;
  accountName: string;
  categoryName: string | null;
  contactName: string | null;
  destinationAccountName: string | null;
};

/** Search + filter spec (PRD #29, #30). */
export type TxFilters = {
  q?: string;
  from?: string; // yyyy-mm-dd
  to?: string; // yyyy-mm-dd
  accountId?: string;
  categoryId?: string;
  type?: TxType;
  min?: number;
  max?: number;
  contactId?: string;
};

const PAGE_SIZE = 20;

function ilike(col: unknown, q: string) {
  return sql`${col} ilike ${`%${q}%`}`;
}

function whereClause(userId: string, f: TxFilters) {
  const conds: SQL[] = [eq(transactions.userId, userId)];
  if (f.q) {
    const q = f.q.trim();
    conds.push(
      or(
        ilike(transactions.description, q),
        ilike(moneyAccounts.name, q),
        ilike(categories.name, q),
        ilike(contacts.name, q)
      )!
    );
  }
  if (f.from) conds.push(gte(transactions.transactionDate, new Date(`${f.from}T00:00:00`)));
  if (f.to) conds.push(lte(transactions.transactionDate, new Date(`${f.to}T23:59:59`)));
  if (f.accountId) conds.push(eq(transactions.accountId, f.accountId));
  if (f.categoryId) conds.push(eq(transactions.categoryId, f.categoryId));
  if (f.type) conds.push(eq(transactions.type, f.type));
  if (f.min !== undefined && f.min > 0) conds.push(gte(transactions.amount, f.min));
  if (f.max !== undefined && f.max > 0) conds.push(lte(transactions.amount, f.max));
  if (f.contactId) conds.push(eq(transactions.contactId, f.contactId));
  return and(...conds);
}

/** Paginated history, newest first. Returns items + whether more exist. */
export async function getTxPage(
  userId: string,
  page = 1,
  filters: TxFilters = {}
): Promise<{ items: TxListItem[]; hasMore: boolean }> {
  const offset = (page - 1) * PAGE_SIZE;

  const rows = await db
    .select({
      id: transactions.id,
      type: transactions.type,
      amount: transactions.amount,
      description: transactions.description,
      notes: transactions.notes,
      transactionDate: transactions.transactionDate,
      accountId: transactions.accountId,
      accountName: moneyAccounts.name,
      categoryName: categories.name,
      contactName: contacts.name,
      destName: transfers.destinationAccountId,
    })
    .from(transactions)
    .innerJoin(moneyAccounts, eq(moneyAccounts.id, transactions.accountId))
    .leftJoin(categories, eq(categories.id, transactions.categoryId))
    .leftJoin(contacts, eq(contacts.id, transactions.contactId))
    .leftJoin(transfers, eq(transfers.transactionId, transactions.id))
    .where(whereClause(userId, filters))
    .orderBy(desc(transactions.transactionDate))
    .offset(offset)
    .limit(PAGE_SIZE + 1);

  const hasMore = rows.length > PAGE_SIZE;
  const items = rows.slice(0, PAGE_SIZE);

  // Resolve destination account names for transfers (batch)
  const destIds = [...new Set(items.filter((r) => r.destName).map((r) => r.destName as string))];
  const destNames =
    destIds.length > 0
      ? await db
          .select({ id: moneyAccounts.id, name: moneyAccounts.name })
          .from(moneyAccounts)
          .where(and(eq(moneyAccounts.userId, userId), sql`${moneyAccounts.id} IN (${destIds.join(",")})`))
      : [];

  const nameById = new Map(destNames.map((d) => [d.id, d.name]));
  return {
    items: items.map((r) => ({
      id: r.id,
      type: r.type,
      amount: r.amount,
      description: r.description,
      notes: r.notes,
      transactionDate: r.transactionDate,
      accountId: r.accountId,
      accountName: r.accountName,
      categoryName: r.categoryName,
      contactName: r.contactName,
      destinationAccountName: r.destName ? (nameById.get(r.destName) ?? null) : null,
    })),
    hasMore,
  };
}

export type TxDetail = {
  id: string;
  type: TxType;
  amount: number;
  description: string;
  notes: string | null;
  transactionDate: Date;
  accountId: string;
  accountName: string;
  categoryId: string | null;
  categoryName: string | null;
  contactId: string | null;
  contactName: string | null;
  sourceAccountId: string | null;
  destinationAccountId: string | null;
};

/** Single transaction with joins; null when not owned by user. */
export async function getTxDetail(userId: string, id: string): Promise<TxDetail | null> {
  const row = await db
    .select({
      id: transactions.id,
      type: transactions.type,
      amount: transactions.amount,
      description: transactions.description,
      notes: transactions.notes,
      transactionDate: transactions.transactionDate,
      accountId: transactions.accountId,
      accountName: moneyAccounts.name,
      categoryId: transactions.categoryId,
      categoryName: categories.name,
      contactId: transactions.contactId,
      contactName: contacts.name,
      sourceAccountId: transfers.sourceAccountId,
      destinationAccountId: transfers.destinationAccountId,
    })
    .from(transactions)
    .innerJoin(moneyAccounts, eq(moneyAccounts.id, transactions.accountId))
    .leftJoin(categories, eq(categories.id, transactions.categoryId))
    .leftJoin(contacts, eq(contacts.id, transactions.contactId))
    .leftJoin(transfers, eq(transfers.transactionId, transactions.id))
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
    .limit(1);

  if (!row.length) return null;
  return row[0];
}

/** Receipts attached to a transaction (PRD #31 view receipt). */
export async function getReceiptsForTransaction(userId: string, transactionId: string) {
  return (
    (await db.query.receipts.findMany({
      where: and(eq(receipts.userId, userId), eq(receipts.transactionId, transactionId)),
      orderBy: [desc(receipts.createdAt)],
    })) ?? []
  );
}