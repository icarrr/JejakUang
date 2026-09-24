import { formatRp } from "@/lib/format";
import type { TxType } from "@/lib/balance";

export function TxSign({ type, amount }: { type: TxType; amount: number }) {
  if (type === "INCOME") return <span className="font-bold text-emerald-600">+{formatRp(amount)}</span>;
  if (type === "EXPENSE") return <span className="font-bold text-red-600">-{formatRp(amount)}</span>;
  if (type === "TRANSFER") return <span className="font-bold text-neutral-500">{formatRp(amount)}</span>;
  // Loan/debt types: real money moves but NOT income/expense (PRD #8.4-8.7) — neutral tone.
  const sign = type === "LOAN_GIVEN" || type === "DEBT_PAYMENT" ? "-" : "+";
  return <span className="font-bold text-neutral-500">{sign}{formatRp(amount)}</span>;
}

export function TxTypeLabel(type: TxType): string {
  switch (type) {
    case "INCOME":
      return "Uang Masuk";
    case "EXPENSE":
      return "Pengeluaran";
    case "TRANSFER":
      return "Transfer";
    case "LOAN_GIVEN":
      return "Pinjamkan";
    case "LOAN_REPAYMENT":
      return "Terima Pembayaran";
    case "DEBT_RECEIVED":
      return "Terima Hutang";
    case "DEBT_PAYMENT":
      return "Bayar Hutang";
  }
}