"use client";

import { useActionState, useState } from "react";
import type { ActionState } from "@/actions/account";
import { SubmitButton } from "@/components/forms";

const TYPES = [
  { value: "CASH", label: "🏦 Cash" },
  { value: "BANK", label: "🏛️ Bank" },
  { value: "E_WALLET", label: "📱 E-Wallet" },
  { value: "CREDIT_CARD", label: "💳 Kartu Kredit" },
  { value: "OTHER", label: "📦 Lainnya" },
];

export function AccountForm({
  existing,
  action,
  submitLabel,
}: {
  existing?: { id: string; name: string; type: string; initialBalance: number };
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});
  const [initialBalance, setInitialBalance] = useState(
    existing ? String(existing.initialBalance) : ""
  );

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Nama Akun</span>
        <input
          name="name"
          required
          defaultValue={existing?.name}
          placeholder="Misal: BCA, Cash, GoPay"
          className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 outline-none focus:border-emerald-600"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Jenis</span>
        <select
          name="type"
          defaultValue={existing?.type ?? "CASH"}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 outline-none focus:border-emerald-600"
        >
          {TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Saldo Awal</span>
        <input
          name="initialBalance"
          inputMode="numeric"
          required
          value={initialBalance}
          onChange={(e) => setInitialBalance(e.target.value.replace(/[^\d]/g, ""))}
          placeholder="0"
          className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 outline-none focus:border-emerald-600"
        />
        <span className="mt-1 block text-xs text-neutral-400">
          Bisa dikosongkan (0) jika akun baru.
        </span>
      </label>
      <SubmitButton className="w-full">{submitLabel}</SubmitButton>
      <p className="text-center text-xs text-neutral-400">
        Saldo akun = saldo awal + seluruh transaksi.
      </p>
    </form>
  );
}