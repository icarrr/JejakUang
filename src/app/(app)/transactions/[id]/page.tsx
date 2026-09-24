import Link from "next/link";
import { notFound } from "next/navigation";
import { getTxDetail, getReceiptsForTransaction } from "@/lib/transactions-query";
import { getBalances } from "@/lib/balance";
import { requireUser } from "@/lib/require-user";
import { TxSign, TxTypeLabel } from "@/components/tx";
import { DeleteTransactionButton } from "@/components/delete-button";

export const dynamic = "force-dynamic";

export default async function TransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const userId = await requireUser();
  const { id } = await params;
  const [tx, balances, receipts] = await Promise.all([
    getTxDetail(userId, id),
    getBalances(userId),
    getReceiptsForTransaction(userId, id),
  ]);
  if (!tx) notFound();

  const accountById = new Map(balances.accounts.map((a) => [a.id, a.name]));
  const destName = tx.destinationAccountId ? accountById.get(tx.destinationAccountId) : null;

  const dateText = tx.transactionDate.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-2xl font-bold">Detail Transaksi</h1>

      <section className="rounded-2xl border border-neutral-200 bg-white p-6 text-center shadow-sm">
        <p className="text-sm text-neutral-500">{TxTypeLabel(tx.type)}</p>
        <p className="mt-2 text-3xl font-bold">
          <TxSign type={tx.type} amount={tx.amount} />
        </p>
        {tx.description && <p className="mt-2 font-medium">{tx.description}</p>}
        <p className="mt-1 text-sm text-neutral-500">{dateText}</p>
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-neutral-500">Akun</dt>
            <dd className="font-medium">
              {tx.accountName}
              {tx.type === "TRANSFER" && destName ? ` → ${destName}` : ""}
            </dd>
          </div>
          {tx.categoryName && (
            <div className="flex justify-between">
              <dt className="text-neutral-500">Kategori</dt>
              <dd className="font-medium">{tx.categoryName}</dd>
            </div>
          )}
          {tx.contactName && (
            <div className="flex justify-between">
              <dt className="text-neutral-500">Kontak</dt>
              <dd className="font-medium">{tx.contactName}</dd>
            </div>
          )}
          {tx.notes && (
            <div className="flex justify-between gap-4">
              <dt className="shrink-0 text-neutral-500">Catatan</dt>
              <dd className="text-right">{tx.notes}</dd>
            </div>
          )}
        </dl>
      </section>

      {/* Receipt (PRD #22, #31) */}
      {receipts.length > 0 && (
        <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold">Struk</h2>
          <ul className="space-y-2">
            {receipts.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate text-neutral-500">{r.fileName}</span>
                <a
                  href={r.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 font-medium text-emerald-700 hover:underline"
                >
                  Lihat Struk ↗
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex gap-3">
        <Link
          href={`/transactions/${tx.id}/edit`}
          className="flex-1 rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-center font-semibold hover:bg-neutral-50"
        >
          Edit
        </Link>
        <DeleteTransactionButton
          id={tx.id}
          description={tx.description || tx.categoryName || tx.contactName || "Transaksi"}
          amount={tx.amount}
          type={tx.type}
        />
      </div>

      <p className="text-center text-xs text-neutral-400">
        Saldo akun dihitung otomatis dari seluruh transaksi. Pinjaman dan hutang tidak dihitung
        sebagai pengeluaran atau pemasukan.
      </p>
    </div>
  );
}