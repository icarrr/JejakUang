import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { contacts } from "@/db/schema";
import { notFound } from "next/navigation";
import { getTxDetail } from "@/lib/transactions-query";
import { getBalances } from "@/lib/balance";
import { getCategoriesForUser } from "@/lib/categories";
import { requireUser } from "@/lib/require-user";
import { TransactionForm } from "@/components/transaction-form";
import { updateTransactionAction } from "@/actions/transaction";

export const dynamic = "force-dynamic";

export default async function EditTransactionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const userId = await requireUser();
  const { id } = await params;
  const [tx, balances, expenseCats, incomeCats, userContacts] = await Promise.all([
    getTxDetail(userId, id),
    getBalances(userId),
    getCategoriesForUser(userId, "EXPENSE"),
    getCategoriesForUser(userId, "INCOME"),
    db.query.contacts.findMany({
      where: eq(contacts.userId, userId),
      orderBy: [asc(contacts.name)],
    }),
  ]);
  if (!tx) notFound();

  const accounts = balances.accounts.map((a) => ({ id: a.id, name: a.name, isActive: a.isActive }));
  const toOpt = (c: { id: string; name: string; icon: string }) => ({
    id: c.id,
    name: c.name,
    icon: c.icon,
  });

  return (
    <div className="mx-auto max-w-md space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Edit Transaksi</h1>
        <Link href={`/transactions/${tx.id}`} className="text-sm font-medium text-emerald-700 hover:underline">
          Kembali
        </Link>
      </div>
      <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <TransactionForm
          accounts={accounts}
          expenseCategories={expenseCats.map(toOpt)}
          incomeCategories={incomeCats.map(toOpt)}
          contacts={userContacts.map((c) => ({ id: c.id, name: c.name }))}
          existing={{
            id: tx.id,
            type: tx.type,
            amount: tx.amount,
            description: tx.description,
            notes: tx.notes,
            transactionDate: tx.transactionDate,
            accountId: tx.accountId,
            categoryId: tx.categoryId,
            contactId: tx.contactId,
            sourceAccountId: tx.sourceAccountId,
            destinationAccountId: tx.destinationAccountId,
          }}
          action={updateTransactionAction.bind(null, id)}
          submitLabel="Simpan Perubahan"
        />
      </div>
    </div>
  );
}