"use client";

import { useActionState, useState } from "react";
import {
  createCategoryAction,
  updateCategoryAction,
  deactivateCategoryAction,
  type ActionState,
} from "@/actions/category";

export function AddCategoryForm() {
  const [state, formAction] = useActionState<ActionState, FormData>(createCategoryAction, {});

  return (
    <form action={formAction} className="rounded-xl border border-neutral-200 p-4">
      {state.error && (
        <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-[2.5rem_1fr_9rem_auto]">
        <input
          name="icon"
          placeholder="🙂"
          maxLength={4}
          className="w-full rounded-lg border border-neutral-300 px-2 py-2 text-center outline-none focus:border-emerald-600"
        />
        <input
          name="name"
          required
          placeholder="Nama kategori baru"
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:border-emerald-600"
        />
        <select
          name="type"
          defaultValue="EXPENSE"
          className="w-full rounded-lg border border-neutral-300 px-2 py-2 text-sm outline-none focus:border-emerald-600"
        >
          <option value="EXPENSE">Pengeluaran</option>
          <option value="INCOME">Pemasukan</option>
        </select>
        <button
          type="submit"
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
        >
          Tambah
        </button>
      </div>
    </form>
  );
}

export function EditCategoryForm({
  category,
}: {
  category: { id: string; name: string; icon: string; type: "INCOME" | "EXPENSE" };
}) {
  const [editing, setEditing] = useState(false);
  const [state, formAction] = useActionState<ActionState, FormData>(
    updateCategoryAction.bind(null, category.id),
    {}
  );
  const [, deactivateAction] = useActionState<ActionState, FormData>(
    async () => {
      if (!window.confirm(`Nonaktifkan kategori “${category.name}”?`)) return {};
      return deactivateCategoryAction(category.id);
    },
    {}
  );

  if (!editing) {
    return (
      <div className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-neutral-50">
        <span className="text-sm">
          {category.icon} {category.name}
        </span>
        <span className="flex gap-2 text-xs">
          <button
            onClick={() => setEditing(true)}
            className="font-medium text-emerald-700 hover:underline"
          >
            Edit
          </button>
          <form action={deactivateAction}>
            <button
              type="submit"
              className="font-medium text-red-600 hover:underline"
            >
              Nonaktifkan
            </button>
          </form>
        </span>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2 rounded-lg px-3 py-2">
      <input
        name="icon"
        defaultValue={category.icon}
        maxLength={4}
        className="w-12 rounded-lg border border-neutral-300 px-2 py-1 text-center text-sm outline-none"
      />
      <input
        name="name"
        required
        defaultValue={category.name}
        className="min-w-0 flex-1 rounded-lg border border-neutral-300 px-3 py-1 text-sm outline-none focus:border-emerald-600"
      />
      <input type="hidden" name="type" value={category.type} />
      {state.error && <span className="text-xs text-red-700">{state.error}</span>}
      <button
        type="submit"
        className="rounded-lg bg-emerald-700 px-3 py-1 text-sm font-semibold text-white hover:bg-emerald-800"
      >
        Simpan
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        className="text-sm text-neutral-500 hover:underline"
      >
        Batal
      </button>
    </form>
  );
}