"use client";

import { useActionState, useState } from "react";
import type { ActionState } from "@/actions/transaction";
import { SubmitButton } from "@/components/forms";
import MoneyInput from "@/components/money-input";
import { toDateInput } from "@/lib/format";
import type { TxType } from "@/lib/balance";

type AccountOpt = { id: string; name: string; isActive: boolean };
type CategoryOpt = { id: string; name: string; icon: string };
type ContactOpt = { id: string; name: string };

const TABS = [
  { value: "EXPENSE", label: "Pengeluaran" },
  { value: "INCOME", label: "Uang Masuk" },
  { value: "TRANSFER", label: "Transfer" },
  { value: "LOAN_GIVEN", label: "Pinjamkan" },
  { value: "LOAN_ACTION", label: "Bayar/Terima" },
] as const;

/** Sub-actions under the "Bayar/Terima" tab (PRD #13). */
const LOAN_SUBTYPES: Array<{ value: TxType; label: string }> = [
  { value: "LOAN_REPAYMENT", label: "Terima pembayaran pinjaman" },
  { value: "DEBT_RECEIVED", label: "Menerima hutang" },
  { value: "DEBT_PAYMENT", label: "Bayar hutang" },
];

const LOAN_TYPES: TxType[] = ["LOAN_GIVEN", "LOAN_REPAYMENT", "DEBT_RECEIVED", "DEBT_PAYMENT"];

type Existing = {
  id: string;
  type: TxType;
  amount: number;
  description: string;
  notes: string | null;
  transactionDate: Date;
  accountId: string;
  categoryId: string | null;
  contactId: string | null;
  sourceAccountId: string | null;
  destinationAccountId: string | null;
};

export function TransactionForm({
  accounts,
  expenseCategories,
  incomeCategories,
  contacts,
  existing,
  action,
  submitLabel,
}: {
  accounts: AccountOpt[];
  expenseCategories: CategoryOpt[];
  incomeCategories: CategoryOpt[];
  contacts: ContactOpt[];
  existing?: Existing;
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});
  const isLoanSub =
    !!existing && existing.type !== "LOAN_GIVEN" && LOAN_TYPES.includes(existing.type);
  const [tab, setTab] = useState<string>(isLoanSub ? "LOAN_ACTION" : (existing?.type ?? "EXPENSE"));
  const [subtype, setSubtype] = useState<TxType>(
    existing && LOAN_TYPES.includes(existing.type) && existing.type !== "LOAN_GIVEN" ? existing.type : "LOAN_REPAYMENT"
  );
  const [newContact, setNewContact] = useState(false);
  const lockedType = !!existing;

  const type: TxType = tab === "LOAN_ACTION" ? subtype : (tab as TxType);
  const cats = type === "INCOME" ? incomeCategories : expenseCategories;
  const defaultDate = existing ? toDateInput(existing.transactionDate) : toDateInput(new Date());
  const isLoanType = LOAN_TYPES.includes(type);

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}

      {/* Current effective type, always submitted */}
      {!lockedType && <input type="hidden" name="type" value={type} />}

      {/* Type tabs */}
      {!lockedType && (
        <>
          <div className="grid grid-cols-5 gap-1.5">
            {TABS.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setTab(t.value)}
                className={`rounded-lg border px-2 py-2 text-xs font-medium transition-colors sm:text-sm ${
                  tab === t.value
                    ? "border-emerald-700 bg-emerald-700 text-white"
                    : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          {tab === "LOAN_ACTION" && (
            <div className="flex flex-col gap-1.5 rounded-lg border border-neutral-200 p-3">
              {LOAN_SUBTYPES.map((s) => (
                <label key={s.value} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="loanSubtype"
                    checked={subtype === s.value}
                    onChange={() => setSubtype(s.value)}
                    className="accent-emerald-700"
                  />
                  {s.label}
                </label>
              ))}
            </div>
          )}
        </>
      )}
      {lockedType && <input type="hidden" name="type" value={type} />}

      {/* Amount */}
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Nominal</span>
        <MoneyInput
          name="amount"
          defaultValue={existing ? String(existing.amount) : ""}
          required
          autoFocus
        />
      </label>

      {/* Transfer accounts */}
      {type === "TRANSFER" ? (
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Dari</span>
            <select
              name="sourceAccountId"
              required
              defaultValue={existing?.sourceAccountId ?? ""}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 outline-none focus:border-emerald-600"
            >
              <option value="" disabled>
                Pilih akun
              </option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Ke</span>
            <select
              name="destinationAccountId"
              required
              defaultValue={existing?.destinationAccountId ?? ""}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 outline-none focus:border-emerald-600"
            >
              <option value="" disabled>
                Pilih akun
              </option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">
              {isLoanType ? "Dari Akun" : "Akun"}
            </span>
            <select
              name="accountId"
              required
              defaultValue={existing?.accountId ?? ""}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 outline-none focus:border-emerald-600"
            >
              <option value="" disabled>
                Pilih akun
              </option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} {!a.isActive ? "(nonaktif)" : ""}
                </option>
              ))}
            </select>
          </label>
          {!isLoanType && (
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Kategori</span>
              <select
                name="categoryId"
                required
                defaultValue={existing?.categoryId ?? ""}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 outline-none focus:border-emerald-600"
              >
                <option value="" disabled>
                  Pilih kategori
                </option>
                {cats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon} {c.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}

      {/* Contact (loan/debt types) */}
      {isLoanType && (
        <div className="rounded-lg border border-neutral-200 p-3">
          {newContact || contacts.length === 0 ? (
            <label className="block">
              <span className="mb-1 block text-sm font-medium">
                Nama kontak baru ({type === "LOAN_GIVEN" || type === "LOAN_REPAYMENT" ? "peminjam" : "pemberi hutang"})
              </span>
              <input
                name="contactName"
                required
                autoFocus={!!contacts.length}
                defaultValue=""
                placeholder="Misal: Andi"
                className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 outline-none focus:border-emerald-600"
              />
            </label>
          ) : (
            <label className="block">
              <span className="mb-1 block text-sm font-medium">
                {type === "LOAN_GIVEN" ? "Kepada" : type === "DEBT_RECEIVED" ? "Dari" : "Dari"} (kontak)
              </span>
              <select
                name="contactId"
                required
                defaultValue={existing?.contactId ?? ""}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 outline-none focus:border-emerald-600"
              >
                <option value="" disabled>
                  Pilih kontak
                </option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {contacts.length > 0 && (
            <button
              type="button"
              onClick={() => setNewContact((v) => !v)}
              className="mt-2 text-xs font-medium text-emerald-700 hover:underline"
            >
              {newContact ? "Pilih kontak yang ada" : "+ Kontak baru"}
            </button>
          )}
        </div>
      )}

      <label className="block">
        <span className="mb-1 block text-sm font-medium">Tanggal</span>
        <input
          name="date"
          type="date"
          required
          defaultValue={defaultDate}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 outline-none focus:border-emerald-600"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium">
          {type === "TRANSFER" ? "Catatan (opsional)" : "Deskripsi (opsional)"}
        </span>
        <input
          name="description"
          defaultValue={existing?.description ?? ""}
          placeholder={type === "TRANSFER" ? "Misal: isi saldo GoPay" : "Misal: Belanja mingguan"}
          maxLength={300}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 outline-none focus:border-emerald-600"
        />
      </label>

      {type !== "TRANSFER" && (
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Catatan (opsional)</span>
          <textarea
            name="notes"
            defaultValue={existing?.notes ?? ""}
            rows={2}
            placeholder="Catatan tambahan…"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 outline-none focus:border-emerald-600"
          />
        </label>
      )}

      {/* Receipt (PRD #14, #22) */}
      {type !== "TRANSFER" && (
        <label className="block">
          <span className="mb-1 block text-sm font-medium">
            Struk (opsional) {existing ? "— mengganti struk lama" : ""}
          </span>
          <input
            name="receipt"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-600 file:mr-3 file:rounded file:border-0 file:bg-emerald-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-emerald-700"
          />
          <span className="mt-1 block text-xs text-neutral-400">
            JPG, PNG, atau WEBP. Maksimal 5 MB.
          </span>
        </label>
      )}

      <SubmitButton className="w-full">{submitLabel}</SubmitButton>
    </form>
  );
}