import Link from "next/link";
import { getBalances } from "@/lib/balance";
import { requireUser } from "@/lib/require-user";
import { formatRp } from "@/lib/format";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  CASH: "🏦 Cash",
  BANK: "🏛️ Bank",
  E_WALLET: "📱 E-Wallet",
  CREDIT_CARD: "💳 Kartu Kredit",
  OTHER: "📦 Lainnya",
};

export default async function AccountsPage() {
  const userId = await requireUser();
  const { accounts, totalBalance, totalActiveBalance } = await getBalances(userId);
  const active = accounts.filter((a) => a.isActive);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Akun</h1>
        <Link
          href="/accounts/new"
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
        >
          + Tambah Akun
        </Link>
      </div>

      {accounts.length === 0 ? (
        <section className="rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
          <p className="text-4xl">👛</p>
          <h2 className="mt-4 text-lg font-semibold">Tambahkan akun pertamamu</h2>
          <p className="mx-auto mt-2 max-w-xs text-sm text-neutral-500">
            Contoh: BCA, Cash, GoPay. Catat saldo awalnya, lalu mulai mencatat transaksi.
          </p>
          <Link
            href="/accounts/new"
            className="mt-6 inline-block rounded-lg bg-emerald-700 px-5 py-2.5 font-semibold text-white hover:bg-emerald-800"
          >
            + Tambah Akun
          </Link>
        </section>
      ) : (
        <>
          <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <ul className="divide-y divide-neutral-100">
              {accounts.map((a) => (
                <li key={a.id}>
                  <div className="flex items-center justify-between gap-3 px-5 py-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {a.name}
                        {!a.isActive && (
                          <span className="ml-2 rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-500">
                            nonaktif
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-neutral-400">{TYPE_LABEL[a.type] ?? a.type}</p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                      <div className="text-right">
                        <p className="font-bold">{formatRp(a.balance)}</p>
                        {a.initialBalance > 0 && (
                          <p className="text-xs text-neutral-400">
                            + {formatRp(a.initialBalance)} awal
                          </p>
                        )}
                      </div>
                      {a.isActive ? (
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/transactions?account=${a.id}`}
                            className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm font-medium hover:bg-neutral-50"
                          >
                            Transaksi
                          </Link>
                          <Link
                            href={`/accounts/${a.id}/edit`}
                            className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm font-medium hover:bg-neutral-50"
                          >
                            Edit
                          </Link>
                        </div>
                      ) : (
                        <span className="w-14" />
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between border-t border-neutral-100 px-5 py-4">
              <span className="text-sm text-neutral-500">
                Total{active.length !== accounts.length ? " (aktif)" : ""}
              </span>
              <span className="font-bold">
                {formatRp(active.length === accounts.length ? totalBalance : totalActiveBalance)}
              </span>
            </div>
          </section>

          {active.length > 0 && (
            <p className="text-center text-xs text-neutral-400">
              Akun dengan transaksi tidak bisa dihapus. Gunakan “Nonaktifkan”.
            </p>
          )}
        </>
      )}
    </div>
  );
}