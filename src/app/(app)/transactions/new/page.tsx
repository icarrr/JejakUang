import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { contacts } from "@/db/schema";
import { getBalances } from "@/lib/balance";
import { getCategoriesForUser } from "@/lib/categories";
import { requireUser } from "@/lib/require-user";
import { TransactionForm } from "@/components/transaction-form";
import { createTransactionAction } from "@/actions/transaction";

export const dynamic = "force-dynamic";

export default async function NewTransactionPage() {
  const userId = await requireUser();
  const [balances, expenseCats, incomeCats, userContacts] = await Promise.all([
    getBalances(userId),
    getCategoriesForUser(userId, "EXPENSE"),
    getCategoriesForUser(userId, "INCOME"),
    db.query.contacts.findMany({
      where: eq(contacts.userId, userId),
      orderBy: [asc(contacts.name)],
    }),
  ]);

  const accounts = balances.accounts
    .filter((a) => a.isActive)
    .map((a) => ({ id: a.id, name: a.name, isActive: a.isActive }));

  if (accounts.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">+ Catat Transaksi</h1>
        <section className="rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
          <p className="text-4xl">👛</p>
          <h2 className="mt-4 text-lg font-semibold">Tambahkan akun pertamamu</h2>
          <p className="mx-auto mt-2 max-w-xs text-sm text-neutral-500">
            Transaksi membutuhkan akun sebagai asal atau tujuan uang.
          </p>
          <Link
            href="/accounts"
            className="mt-6 inline-block rounded-lg bg-emerald-700 px-5 py-2.5 font-semibold text-white hover:bg-emerald-800"
          >
            + Tambah Akun
          </Link>
        </section>
      </div>
    );
  }

  const toOpt = (c: { id: string; name: string; icon: string }) => ({
    id: c.id,
    name: c.name,
    icon: c.icon,
  });

  return (
    <div className="mx-auto max-w-md space-y-5">
      <h1 className="text-2xl font-bold">+ Catat Transaksi</h1>
      <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <TransactionForm
          accounts={accounts}
          expenseCategories={expenseCats.map(toOpt)}
          incomeCategories={incomeCats.map(toOpt)}
          contacts={userContacts.map((c) => ({ id: c.id, name: c.name }))}
          action={createTransactionAction}
          submitLabel="Simpan"
        />
      </div>
    </div>
  );
}