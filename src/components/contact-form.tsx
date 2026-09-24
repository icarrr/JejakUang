"use client";

import { useActionState } from "react";
import { createContactAction, type ActionState } from "@/actions/contact";

export function AddContactForm() {
  const [state, formAction] = useActionState<ActionState, FormData>(createContactAction, {});

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input
        name="name"
        required
        placeholder="Nama kontak (misal: Andi)"
        className="w-44 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm outline-none focus:border-emerald-600"
      />
      <input
        name="phone"
        placeholder="Telepon (opsional)"
        className="w-36 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm outline-none focus:border-emerald-600"
      />
      <button
        type="submit"
        className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-800"
      >
        + Tambah Kontak
      </button>
      {state.error && <span className="w-full text-xs text-red-700">{state.error}</span>}
    </form>
  );
}