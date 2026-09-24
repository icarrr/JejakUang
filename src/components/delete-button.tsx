"use client";

import { useActionState } from "react";
import { deleteTransactionAction, type ActionState } from "@/actions/transaction";
import type { TxType } from "@/lib/balance";

export function DeleteTransactionButton({
  id,
  description,
  amount,
  type,
}: {
  id: string;
  description: string;
  amount: number;
  type: TxType;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async () => {
      if (
        !window.confirm(
          `Hapus transaksi?\n\n${description}\n${["INCOME", "LOAN_REPAYMENT", "DEBT_RECEIVED"].includes(type) ? "+" : "-"} Rp${amount.toLocaleString(
            "id-ID"
          )}\n\nTindakan ini tidak bisa dibatalkan.`
        )
      ) {
        return {};
      }
      return deleteTransactionAction(id);
    },
    {}
  );

  return (
    <form action={formAction}>
      <button
        type="submit"
        disabled={pending}
        className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 font-semibold text-white hover:bg-red-700 disabled:opacity-60"
      >
        {pending ? "Menghapus…" : "Hapus"}
      </button>
      {state.error && <p className="mt-2 text-sm text-red-700">{state.error}</p>}
    </form>
  );
}