import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { requireUser } from "@/lib/require-user";
import { AddCategoryForm, EditCategoryForm } from "@/components/category-forms";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const userId = await requireUser();
  const all = await db.query.categories.findMany({
    where: eq(categories.userId, userId),
    orderBy: [asc(categories.type), asc(categories.isDefault), asc(categories.name)],
  });
  const expense = all.filter((c) => c.type === "EXPENSE");
  const income = all.filter((c) => c.type === "INCOME");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Pengaturan</h1>

      <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-semibold">Halaman Lain</h2>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/loans"
            className="rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium hover:bg-neutral-50"
          >
            🤝 Pinjaman
          </Link>
          <Link
            href="/reports"
            className="rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium hover:bg-neutral-50"
          >
            📊 Laporan & Anggaran
          </Link>
        </div>
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-semibold">Kategori</h2>
        <AddCategoryForm />
        <div className="mt-6 space-y-6">
          <CategoryGroup title="Pengeluaran" items={expense} />
          <CategoryGroup title="Pemasukan" items={income} />
        </div>
      </section>
    </div>
  );
}

async function CategoryGroup({
  title,
  items,
}: {
  title: string;
  items: typeof categories.$inferSelect[];
}) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-medium text-neutral-500">{title}</h3>
      <ul className="space-y-1.5">
        {items.map((c) => (
          <li key={c.id}>
            {c.isDefault ? (
              <div className="flex min-w-0 items-center justify-between rounded-lg bg-neutral-50 px-3 py-2">
                <span className="min-w-0 truncate text-sm">
                  {c.icon} {c.name}
                </span>
                <span className="shrink-0 text-xs text-neutral-400">bawaan</span>
              </div>
            ) : c.isActive ? (
              <EditCategoryForm
                category={{ id: c.id, name: c.name, icon: c.icon, type: c.type }}
              />
            ) : (
              <div className="flex min-w-0 items-center justify-between rounded-lg bg-neutral-50 px-3 py-2 opacity-60">
                <span className="min-w-0 truncate text-sm">
                  {c.icon} {c.name}
                </span>
                <span className="shrink-0 text-xs text-neutral-400">nonaktif</span>
              </div>
            )}
          </li>
        ))}
        {items.length === 0 && (
          <li className="px-3 py-2 text-sm text-neutral-400">Belum ada kategori.</li>
        )}
      </ul>
    </div>
  );
}