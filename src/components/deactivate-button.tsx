"use client";

import { useActionState } from "react";
import { deactivateAccountAction, type ActionState } from "@/actions/account";

export function DeactivateAccountButton({ id, name }: { id: string; name: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async () => {
      if (
        !window.confirm(
          `Nonaktifkan akun “${name}”?\n\nAkun tidak akan muncul di total saldo dan pemilihan akun, tetapi riwayat tetap tersimpan.`
        )
      ) {
        return {};
      }
      return deactivateAccountAction(id);
    },
    {}
  );

  return (
    <form action={formAction}>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
      >
        {pending ? "…" : "Nonaktifkan"}
      </button>
      {state.error && <p className="mt-1 text-xs text-red-700">{state.error}</p>}
    </form>
  );
}