"use client";

import { useActionState } from "react";
import { upsertBudgetAction, deleteBudgetAction, type ActionState } from "@/actions/budget";
import { formatRp } from "@/lib/format";

type BudgetRow = {
  id: string;
  categoryId: string;
  categoryName: string;
  icon: string;
  amount: number;
  used: number;
};
type CategoryOpt = { id: string; name: string; icon: string };

export function BudgetSection({ month, budgets, categories }: { month: string; budgets: BudgetRow[]; categories: CategoryOpt[] }) {
  const usedIds = new Set(budgets.map((b) => b.categoryId));
  const available = categories.filter((c) => !usedIds.has(c.id));

  return (
    <div className="space-y-3">
      {budgets.length === 0 && available.length === 0 && (
        <p className="text-sm text-neutral-400">Belum ada anggaran.</p>
      )}

      {budgets.map((b) => (
        <BudgetRowItem key={b.id} b={b} month={month} />
      ))}

      {available.length > 0 && (
        <AddBudgetForm month={month} categories={available} />
      )}
    </div>
  );
}

function BudgetRowItem({ b, month }: { b: BudgetRow; month: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    upsertBudgetAction,
    {}
  );
  const [delState, delAction] = useActionState<ActionState, FormData>(
    async () => deleteBudgetAction(b.id),
    {}
  );

  const pct = b.amount > 0 ? Math.min(100, Math.round((b.used / b.amount) * 100)) : 0;
  const remaining = b.amount - b.used;

  return (
    <div className="rounded-xl border border-neutral-200 p-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">
          {b.icon} {b.categoryName}
        </span>
        <span className={remaining >= 0 ? "text-neutral-500" : "font-semibold text-red-600"}>
          {formatRp(remaining)} tersisa
        </span>
      </div>
      <div className="mt-1.5 h-2 rounded-full bg-neutral-100">
        <div
          className={`h-2 rounded-full ${pct > 100 ? "bg-red-500" : pct > 75 ? "bg-amber-500" : "bg-emerald-600"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-neutral-400">
        {formatRp(b.used)} dari {formatRp(b.amount)} ({pct}%)
      </p>

      <div className="mt-2 flex items-center gap-2">
        <form action={formAction} className="flex items-center gap-2">
          <input type="hidden" name="categoryId" value={b.categoryId} />
          <input type="hidden" name="month" value={month} />
          <input
            name="amount"
            inputMode="numeric"
            defaultValue={String(b.amount)}
            placeholder="Nominal"
            className="w-32 rounded-lg border border-neutral-300 px-2 py-1 text-sm outline-none focus:border-emerald-600"
          />
          <button
            type="submit"
            className="rounded-lg border border-neutral-200 px-3 py-1 text-sm font-medium hover:bg-neutral-50"
          >
            Simpan
          </button>
          {state.error && <span className="text-xs text-red-700">{state.error}</span>}
        </form>
        <form action={delAction} className="ml-auto">
          <button
            type="submit"
            className="text-sm text-red-600 hover:underline"
          >
            Hapus
          </button>
          {delState.error && <span className="ml-2 text-xs text-red-700">{delState.error}</span>}
        </form>
      </div>
    </div>
  );
}

function AddBudgetForm({ month, categories }: { month: string; categories: CategoryOpt[] }) {
  const [state, formAction] = useActionState<ActionState, FormData>(upsertBudgetAction, {});
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-neutral-300 p-3">
      <input type="hidden" name="month" value={month} />
      <select
        name="categoryId"
        required
        defaultValue=""
        className="rounded-lg border border-neutral-300 px-2 py-1.5 text-sm outline-none focus:border-emerald-600"
      >
        <option value="" disabled>
          Pilih kategori
        </option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.icon} {c.name}
          </option>
        ))}
      </select>
      <input
        name="amount"
        inputMode="numeric"
        required
        placeholder="Nominal anggaran"
        className="w-36 rounded-lg border border-neutral-300 px-2 py-1.5 text-sm outline-none focus:border-emerald-600"
      />
      <button
        type="submit"
        className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-800"
      >
        + Tambah Anggaran
      </button>
      {state.error && <span className="text-xs text-red-700">{state.error}</span>}
    </form>
  );
}