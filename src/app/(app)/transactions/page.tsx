import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { categories, moneyAccounts } from "@/db/schema";
import { getTxPage, type TxListItem, type TxFilters } from "@/lib/transactions-query";
import { requireUser } from "@/lib/require-user";
import { dateLabel } from "@/lib/format";
import { TxSign } from "@/components/tx";
import { TxFilters as TxFiltersPanel } from "@/components/tx-filters";

export const dynamic = "force-dynamic";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const userId = await requireUser();
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);

  const page = Math.max(1, Number(one("page") ?? 1));
  const filters: TxFilters = {
    q: one("q"),
    from: one("from"),
    to: one("to"),
    accountId: one("account") && /^[0-9a-f-]{36}$/i.test(one("account")!) ? one("account") : undefined,
    categoryId: one("category") && /^[0-9a-f-]{36}$/i.test(one("category")!) ? one("category") : undefined,
    type: one("type") as TxFilters["type"],
    min: one("min") ? Number(one("min")) : undefined,
    max: one("max") ? Number(one("max")) : undefined,
  };

  const [result, accounts, allCategories] = await Promise.all([
    getTxPage(userId, page, filters),
    db.query.moneyAccounts.findMany({
      where: eq(moneyAccounts.userId, userId),
      orderBy: [asc(moneyAccounts.name)],
    }),
    db.query.categories.findMany({
      where: eq(categories.userId, userId),
      orderBy: [asc(categories.name)],
    }),
  ]);
  const { items, hasMore } = result;

  const groups = groupByDay(items);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Riwayat</h1>
        <Link
          href="/transactions/new"
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
        >
          + Catat
        </Link>
      </div>

      <TxFiltersPanel
        accounts={accounts.map((a) => ({ id: a.id, name: a.name }))}
        categories={allCategories.map((c) => ({ id: c.id, name: c.name, icon: c.icon }))}
      />

      {(filters.q || filters.from || filters.to || filters.type || filters.min || filters.max || filters.accountId || filters.categoryId) && (
        <p className="text-sm text-neutral-500">
          Filter aktif.{" "}
          <Link href="/transactions" className="font-medium text-emerald-700 hover:underline">
            Bersihkan semua
          </Link>
        </p>
      )}

      {items.length === 0 ? (
        <section className="rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
          <p className="text-4xl">🧾</p>
          <h2 className="mt-4 text-lg font-semibold">
            {filters.q || filters.from || filters.to || filters.type || filters.min || filters.max || filters.accountId || filters.categoryId
              ? "Tidak ada hasil"
              : "Belum ada transaksi"}
          </h2>
          <p className="mx-auto mt-2 max-w-xs text-sm text-neutral-500">
            {filters.q || filters.from || filters.to || filters.type || filters.min || filters.max || filters.accountId || filters.categoryId
              ? "Coba ubah kata kunci atau filter."
              : "Mulai catat pengeluaran pertamamu untuk mengetahui uangmu pergi ke mana."}
          </p>
          {!filters.q && !filters.from && !filters.to && !filters.type && !filters.min && !filters.max && !filters.accountId && !filters.categoryId && (
            <Link
              href="/transactions/new"
              className="mt-6 inline-block rounded-lg bg-emerald-700 px-5 py-2.5 font-semibold text-white hover:bg-emerald-800"
            >
              + Catat Transaksi
            </Link>
          )}
        </section>
      ) : (
        <div className="space-y-6">
          {groups.map(([day, dayItems]) => (
            <section key={day} className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
              <h2 className="border-b border-neutral-100 px-5 py-3 text-sm font-medium text-neutral-500">
                {day}
              </h2>
              <ul className="divide-y divide-neutral-100">
                {dayItems.map((t) => (
                  <Row key={t.id} t={t} />
                ))}
              </ul>
            </section>
          ))}

          <div className="flex items-center justify-between">
            {page > 1 ? (
              <Link
                href={`/transactions?page=${page - 1}${qsSuffix(sp)}`}
                className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium hover:bg-neutral-50"
              >
                ← Sebelumnya
              </Link>
            ) : (
              <span />
            )}
            {hasMore ? (
              <Link
                href={`/transactions?page=${page + 1}${qsSuffix(sp)}`}
                className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium hover:bg-neutral-50"
              >
                Load more →
              </Link>
            ) : (
              <span />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Preserve current filters when paging. */
function qsSuffix(sp: Record<string, string | string[] | undefined>): string {
  const keep = ["q", "from", "to", "account", "category", "type", "min", "max"];
  const p = new URLSearchParams();
  for (const k of keep) {
    const v = sp[k];
    if (typeof v === "string" && v) p.set(k, v);
  }
  return p.toString() ? `&${p}` : "";
}

function Row({ t }: { t: TxListItem }) {
  const title =
    t.description || t.categoryName || t.contactName || (t.type === "TRANSFER" ? "Transfer" : "Transaksi");
  const sub =
    t.type === "TRANSFER" && t.destinationAccountName
      ? `${t.accountName} → ${t.destinationAccountName}`
      : [t.accountName, t.categoryName, t.contactName].filter(Boolean).join(" · ");
  return (
    <li>
      <Link href={`/transactions/${t.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-neutral-50">
        <div className="min-w-0">
          <p className="truncate font-medium">{title}</p>
          <p className="truncate text-xs text-neutral-400">{sub}</p>
        </div>
        <TxSign type={t.type} amount={t.amount} />
      </Link>
    </li>
  );
}

function groupByDay(items: TxListItem[]): Array<[string, TxListItem[]]> {
  const map = new Map<string, TxListItem[]>();
  for (const t of items) {
    const key = dateLabel(t.transactionDate);
    const arr = map.get(key) ?? [];
    arr.push(t);
    map.set(key, arr);
  }
  return [...map.entries()];
}