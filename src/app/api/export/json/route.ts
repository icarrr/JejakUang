import { auth } from "@/auth";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  budgets,
  categories,
  contacts,
  loans,
  moneyAccounts,
  receipts,
  transactions,
  transfers,
} from "@/db/schema";

export const dynamic = "force-dynamic";

function serialize<T extends Record<string, unknown>>(rows: T[]): unknown[] {
  return rows.map((r) =>
    Object.fromEntries(
      Object.entries(r).map(([k, v]) => [k, v instanceof Date ? v.toISOString() : v])
    )
  );
}

/** Full user data backup as JSON (#65 backup/export). */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });
  const userId = session.user.id;

  const [accounts, categoriesRows, contactsRows, txs, transferRows, loanRows, receiptRows, budgetRows] =
    await Promise.all([
      db.select().from(moneyAccounts).where(eq(moneyAccounts.userId, userId)),
      db.select().from(categories).where(eq(categories.userId, userId)),
      db.select().from(contacts).where(eq(contacts.userId, userId)),
      db.select().from(transactions).where(eq(transactions.userId, userId)),
      db.select().from(transfers).where(eq(transfers.userId, userId)),
      db.select().from(loans).where(eq(loans.userId, userId)),
      db.select().from(receipts).where(eq(receipts.userId, userId)),
      db.select().from(budgets).where(eq(budgets.userId, userId)),
    ]);

  const data = {
    exportedAt: new Date().toISOString(),
    accounts: serialize(accounts),
    categories: serialize(categoriesRows),
    contacts: serialize(contactsRows),
    transactions: serialize(txs),
    transfers: serialize(transferRows),
    loans: serialize(loanRows),
    receipts: serialize(receiptRows),
    budgets: serialize(budgetRows),
  };

  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="jejakuang-backup-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}