import { and, eq, sum } from "drizzle-orm";
import { db } from "@/db";
import { loans, transactions } from "@/db/schema";
import type { TxType } from "@/lib/balance";

const LOAN_TYPES: TxType[] = [
  "LOAN_GIVEN",
  "LOAN_REPAYMENT",
  "DEBT_RECEIVED",
  "DEBT_PAYMENT",
];

export function isLoanType(t: TxType): boolean {
  return LOAN_TYPES.includes(t);
}

/** Ledger row type derived from a transaction type (origin of the loan/debt). */
export function ledgerTypeOf(t: TxType): "LOAN_GIVEN" | "DEBT_RECEIVED" | null {
  if (t === "LOAN_GIVEN" || t === "LOAN_REPAYMENT") return "LOAN_GIVEN";
  if (t === "DEBT_RECEIVED" || t === "DEBT_PAYMENT") return "DEBT_RECEIVED";
  return null;
}

/** For a loan tx, the offset type that reduces the balance (repayment/payment). */
export function offsetTypeOf(t: TxType): "LOAN_REPAYMENT" | "DEBT_PAYMENT" | null {
  if (t === "LOAN_GIVEN" || t === "LOAN_REPAYMENT") return "LOAN_REPAYMENT";
  if (t === "DEBT_RECEIVED" || t === "DEBT_PAYMENT") return "DEBT_PAYMENT";
  return null;
}

async function sumsFor(userId: string, contactId: string, origin: "LOAN_GIVEN" | "DEBT_RECEIVED") {
  const originType = origin;
  const offsetType = origin === "LOAN_GIVEN" ? "LOAN_REPAYMENT" : "DEBT_PAYMENT";
  const [grossRow] = await db
    .select({ total: sum(transactions.amount) })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.contactId, contactId),
        eq(transactions.type, originType as TxType)
      )
    );
  const [offsetRow] = await db
    .select({ total: sum(transactions.amount) })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.contactId, contactId),
        eq(transactions.type, offsetType as TxType)
      )
    );
  // sum() infers string|number|null; coerce with Number().
  return { gross: Number(grossRow?.total ?? 0), offset: Number(offsetRow?.total ?? 0) };
}

/** Recompute + upsert single ledger row (per user+contact+origin). Remaining = gross - offset. */
export async function syncLoanLedger(
  userId: string,
  contactId: string,
  origin: "LOAN_GIVEN" | "DEBT_RECEIVED"
) {
  const { gross, offset } = await sumsFor(userId, contactId, origin);
  const remaining = Math.max(0, gross - offset);
  const status = remaining === 0 ? "CLOSED" : "OPEN";

  await db
    .insert(loans)
    .values({
      userId,
      contactId,
      type: origin,
      amount: gross,
      remainingAmount: remaining,
      status,
    })
    .onConflictDoUpdate({
      target: [loans.userId, loans.contactId, loans.type],
      set: { amount: gross, remainingAmount: remaining, status },
    });
}

/** Remaining balance for a ledger (used to guard over-repayment). */
export async function ledgerRemaining(
  userId: string,
  contactId: string,
  origin: "LOAN_GIVEN" | "DEBT_RECEIVED"
): Promise<number> {
  const { gross, offset } = await sumsFor(userId, contactId, origin);
  return Math.max(0, gross - offset);
}

/** Loans page aggregates: piutang (given) + hutang (received), grouped per contact. */
export async function getLoanSummary(userId: string) {
  const rows = await db.query.loans.findMany({
    where: and(eq(loans.userId, userId), eq(loans.status, "OPEN")),
    with: { contact: { columns: { name: true } } },
    orderBy: (l, { asc }) => [asc(l.contactId)],
  });
  const given = rows
    .filter((r) => r.type === "LOAN_GIVEN")
    .map((r) => ({ contactName: r.contact.name, remainingAmount: r.remainingAmount }));
  const received = rows
    .filter((r) => r.type === "DEBT_RECEIVED")
    .map((r) => ({ contactName: r.contact.name, remainingAmount: r.remainingAmount }));
  return {
    piutang: given,
    hutang: received,
    totalPiutang: given.reduce((a, r) => a + r.remainingAmount, 0),
    totalHutang: received.reduce((a, r) => a + r.remainingAmount, 0),
  };
}