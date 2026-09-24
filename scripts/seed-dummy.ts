/**
 * Seed demo user + data (register dummy account + demo transactions).
 * Idempotent: exits early if demo user already exists.
 * Usage: npm run db:seed-dummy
 */
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { asc, eq } from "drizzle-orm";
import { db } from "../src/db";
import { categories, contacts, moneyAccounts, transactions, transfers, users } from "../src/db/schema";
import { DEFAULT_CATEGORIES } from "../src/db/seed-categories";
import { getBalances } from "../src/lib/balance";
import { getLoanSummary, syncLoanLedger } from "../src/lib/loans";

const EMAIL = "demo@jejakuang.dev";
const PASSWORD = "demo1234";

async function main() {
  const existing = await db.query.users.findFirst({ where: eq(users.email, EMAIL) });
  if (existing) {
    console.log(`Demo user ${EMAIL} already exists. Nothing to do.`);
    return;
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const [user] = await db
    .insert(users)
    .values({ name: "Demo User", email: EMAIL, passwordHash })
    .returning();
  const uid = user.id;

  // Default categories (same set as register flow)
  await db
    .insert(categories)
    .values(
      DEFAULT_CATEGORIES.map((c) => ({ userId: uid, name: c.name, type: c.type, icon: c.icon, isDefault: true }))
    )
    .onConflictDoNothing();

  // Accounts
  const [bca] = await db
    .insert(moneyAccounts)
    .values({ userId: uid, name: "BCA", type: "BANK", initialBalance: 5_000_000 })
    .returning();
  const [gopay] = await db
    .insert(moneyAccounts)
    .values({ userId: uid, name: "GoPay", type: "E_WALLET", initialBalance: 0 })
    .returning();

  const catId = async (name: string) => {
    const c = await db.query.categories.findFirst({ where: eq(categories.name, name) });
    return c?.id ?? null;
  };
  const gajiId = await catId("Gaji");
  const makanId = await catId("Makan");
  const kopiId = await catId("Kopi");
  const bbmId = await catId("BBM");

  const today = new Date();
  type NewTx = typeof transactions.$inferInsert;
  const tx = async (values: NewTx) => (await db.insert(transactions).values(values).returning())[0];

  // Salary
  await tx({ userId: uid, accountId: bca.id, type: "INCOME", amount: 10_000_000, categoryId: gajiId, transactionDate: today, description: "Gaji September" });
  // Expenses
  await tx({ userId: uid, accountId: bca.id, type: "EXPENSE", amount: 50_000, categoryId: makanId, transactionDate: today, description: "Makan siang" });
  await tx({ userId: uid, accountId: bca.id, type: "EXPENSE", amount: 25_000, categoryId: kopiId, transactionDate: today, description: "Kopi susu" });
  await tx({ userId: uid, accountId: gopay.id, type: "EXPENSE", amount: 100_000, categoryId: bbmId, transactionDate: today, description: "Bensin" });
  // Transfer
  const tr = await tx({ userId: uid, accountId: bca.id, type: "TRANSFER", amount: 1_000_000, transactionDate: today, description: "Isi saldo GoPay" });
  await db.insert(transfers).values({ userId: uid, transactionId: tr.id, sourceAccountId: bca.id, destinationAccountId: gopay.id });

  // Loan: Andi pinjam 500k, bayar 200k
  const [andi] = await db.insert(contacts).values({ userId: uid, name: "Andi" }).returning();
  await tx({ userId: uid, accountId: bca.id, type: "LOAN_GIVEN", amount: 500_000, contactId: andi.id, transactionDate: today, description: "Pinjaman Andi" });
  await syncLoanLedger(uid, andi.id, "LOAN_GIVEN");
  await tx({ userId: uid, accountId: bca.id, type: "LOAN_REPAYMENT", amount: 200_000, contactId: andi.id, transactionDate: today, description: "Andi bayar sebagian" });
  await syncLoanLedger(uid, andi.id, "LOAN_GIVEN");

  // Verify seeded state matches expected math
  const { accounts, totalActiveBalance } = await getBalances(uid);
  const bcaBal = accounts.find((a) => a.id === bca.id)!.balance;
  const gopayBal = accounts.find((a) => a.id === gopay.id)!.balance;
  assert.equal(bcaBal, 13_625_000, "BCA = 5jt+10jt-50k-25k-1jt-500k+200k");
  assert.equal(gopayBal, 900_000, "GoPay = 0-100k+1jt");
  assert.equal(totalActiveBalance, 14_525_000, "total active");
  const summary = await getLoanSummary(uid);
  assert.equal(summary.totalPiutang, 300_000, "piutang Andi");
  assert.equal(await bcrypt.compare(PASSWORD, passwordHash), true, "password hash matches");

  console.log("Seeded demo user:");
  console.log(`  email:    ${EMAIL}`);
  console.log(`  password: ${PASSWORD}`);
  console.log("  BCA 13.625.000 · GoPay 900.000 · piutang Andi 300.000");
  console.log("Login at http://localhost:3000/login");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});