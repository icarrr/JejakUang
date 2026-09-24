/**
 * Integration smoke test against the live (provisioned) Neon DB.
 * Verifies balance math + loan ledger for all transaction types.
 * Usage: npx tsx scripts/smoke-db.ts
 */
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { contacts, moneyAccounts, transactions, transfers, users } from "../src/db/schema";
import { getBalances } from "../src/lib/balance";
import { getLoanSummary, syncLoanLedger } from "../src/lib/loans";

async function main() {
  const [user] = await db.insert(users).values({ email: `smoke-${Date.now()}@test.dev`, name: "Smoke" }).returning();
  const uid = user.id;

  const [bca] = await db.insert(moneyAccounts).values({ userId: uid, name: "BCA", type: "BANK", initialBalance: 5_000_000 }).returning();
  const [gopay] = await db.insert(moneyAccounts).values({ userId: uid, name: "GoPay", type: "E_WALLET", initialBalance: 0 }).returning();
  const [andi] = await db.insert(contacts).values({ userId: uid, name: "Andi" }).returning();

  const date = new Date();
  const tx = async (type: "INCOME" | "EXPENSE" | "TRANSFER" | "LOAN_GIVEN" | "LOAN_REPAYMENT", accountId: string, amount: number, contactId?: string) =>
    (await db.insert(transactions).values({ userId: uid, accountId, type, amount, contactId, transactionDate: date }).returning())[0];

  // PRD #10 example + loan flow
  await tx("INCOME", bca.id, 10_000_000); // salary
  await tx("EXPENSE", bca.id, 500_000); // food
  const tr = await tx("TRANSFER", bca.id, 1_000_000); // to GoPay
  await db.insert(transfers).values({ userId: uid, transactionId: tr.id, sourceAccountId: bca.id, destinationAccountId: gopay.id });
  await tx("LOAN_GIVEN", bca.id, 500_000, andi.id); // pinjamkan ke Andi
  await syncLoanLedger(uid, andi.id, "LOAN_GIVEN");
  await tx("LOAN_REPAYMENT", bca.id, 200_000, andi.id); // Andi bayar 200k
  await syncLoanLedger(uid, andi.id, "LOAN_GIVEN");

  const { accounts, totalActiveBalance } = await getBalances(uid);
  const bcaBal = accounts.find((a) => a.id === bca.id)!.balance;
  const gopayBal = accounts.find((a) => a.id === gopay.id)!.balance;

  // BCA: 5jt + 10jt - 500k - 1jt - 500k + 200k = 13.2jt
  assert.equal(bcaBal, 13_200_000, "BCA balance");
  assert.equal(gopayBal, 1_000_000, "GoPay balance after transfer");
  assert.equal(totalActiveBalance, 14_200_000, "total active balance");

  const summary = await getLoanSummary(uid);
  assert.equal(summary.totalPiutang, 300_000, "piutang Andi after 200k repayment");
  assert.equal(summary.totalHutang, 0, "no debt");

  // Cleanup (cascades everything)
  await db.delete(users).where(eq(users.id, uid)).catch(() => {});
  console.log("db smoke test: OK (BCA 13.2jt, GoPay 1jt, piutang Andi 300k)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});