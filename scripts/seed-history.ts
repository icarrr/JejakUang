/**
 * Bulk-seed 1–3 years of deterministic personal-finance history.
 *
 * Model: monthly salary (+Dec THR), recurring bills+subscriptions on GoPay,
 * daily discretionary spending (envelope-capped), weekly shopping, monthly
 * BCA->GoPay transfer, scheduled loans/debts with guarded partial repayments,
 * and monthly budgets.
 *
 * Invariants:
 *   - running account balances never go negative (spend() clamps)
 *   - repayments never exceed ledger remaining (guarded inline)
 *   - budgets honor (user, category, month) uniqueness
 *   - deterministic: same seed -> same data
 *
 * Usage:
 *   npm run db:seed-history
 *   npm run db:seed-history -- --months=36 --seed=78453
 *   npm run db:seed-history -- --email=other@user.dev
 */
import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { db } from "../src/db";
import {
  budgets,
  categories,
  contacts,
  loans,
  moneyAccounts,
  transactions,
  transfers,
  users,
} from "../src/db/schema";
import { DEFAULT_CATEGORIES } from "../src/db/seed-categories";
import { getBalances } from "../src/lib/balance";
import { getLoanSummary, syncLoanLedger } from "../src/lib/loans";
import type { TxType } from "../src/lib/balance";

const DEFAULT = { months: 24, seed: 20260101, email: "demo-history@jejakuang.dev" };
const PASSWORD = "demo1234";
const MARKER = "SEED-HISTORY-START";
const MONTH_NAMES = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];

function parseArgs() {
  const a = process.argv.slice(2);
  const get = (k: string) => {
    const i = a.indexOf(k);
    return i >= 0 && i + 1 < a.length ? a[i + 1] : undefined;
  };
  return {
    months: Math.min(60, Math.max(1, Number(get("--months") ?? DEFAULT.months))),
    seed: Number(get("--seed") ?? DEFAULT.seed),
    email: get("--email") ?? DEFAULT.email,
    reset: a.includes("--reset"),
  };
}

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const between = (r: () => number, lo: number, hi: number) =>
  Math.round(lo + r() * (hi - lo));
const atDay = (y: number, m: number, d: number) => new Date(y, m, d, 12, 0, 0);

type NewTx = typeof transactions.$inferInsert;
type NewTransfer = typeof transfers.$inferInsert;

/** Month index m counts months before the current month (0 = current). */
function ym(mIdx: number, thisYear: number, thisMonth: number) {
  const y = thisYear - Math.floor(mIdx / 12);
  const mo = (((thisMonth - (mIdx % 12)) % 12) + 12) % 12;
  return { y, mo };
}

async function main() {
  const { months, seed, email, reset } = parseArgs();
  const r = rng(seed);
  const now = new Date();
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth();

  let user = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!user) {
    const passwordHash = await bcrypt.hash(PASSWORD, 10);
    [user] = await db.insert(users).values({ name: "Demo History", email, passwordHash }).returning();
  }
  const uid = user.id;

  if (reset) {
    await db.delete(budgets).where(eq(budgets.userId, uid));
    await db.delete(loans).where(eq(loans.userId, uid));
    await db.delete(transfers).where(eq(transfers.userId, uid));
    await db.delete(transactions).where(eq(transactions.userId, uid));
    await db.delete(contacts).where(eq(contacts.userId, uid));
    await db.delete(moneyAccounts).where(eq(moneyAccounts.userId, uid));
    console.log(`--reset: cleared history for ${email}`);
  }

  await db
    .insert(categories)
    .values(
      DEFAULT_CATEGORIES.map((c) => ({ userId: uid, name: c.name, type: c.type, icon: c.icon, isDefault: true }))
    )
    .onConflictDoNothing();

  const cat = new Map<string, string>();
  const allCats = await db.query.categories.findMany({ where: eq(categories.userId, uid) });
  for (const c of allCats) cat.set(c.name, c.id);

  const acct = new Map<string, { id: string; balance: number }>();
  const accountSpecs = [
    { key: "BCA", name: "BCA", type: "BANK" as const, initial: 5_000_000 },
    { key: "Mandiri", name: "Mandiri", type: "BANK" as const, initial: 2_000_000 },
    { key: "GoPay", name: "GoPay", type: "E_WALLET" as const, initial: 0 },
    { key: "Cash", name: "Cash", type: "CASH" as const, initial: 500_000 },
  ];
  for (const s of accountSpecs) {
    const [row] = await db
      .insert(moneyAccounts)
      .values({ userId: uid, name: s.name, type: s.type, initialBalance: s.initial })
      .returning();
    acct.set(s.key, { id: row.id, balance: s.initial });
  }

  const marker = await db.query.transactions.findFirst({
    where: and(eq(transactions.userId, uid), eq(transactions.description, MARKER)),
  });
  if (marker) {
    console.log(`History already seeded for ${email} (marker found). Nothing to do.`);
    return;
  }

  const contactIds = new Map<string, string>();
  const ensureContact = async (name: string) => {
    let c = contactIds.get(name);
    if (!c) {
      let row = await db.query.contacts.findFirst({ where: and(eq(contacts.userId, uid), eq(contacts.name, name)) });
      if (!row) [row] = await db.insert(contacts).values({ userId: uid, name }).returning();
      contactIds.set(name, row.id);
      c = row.id;
    }
    return c;
  };

  // Loan/debt plans: start + repayment month indices.
  const plans: Array<{
    contactName: string;
    kind: "give" | "debt";
    amount: number;
    start: number;
    repays: number[];
  }> = [];
  const names = ["Andi", "Budi", "Citra", "Dewi", "Eko", "Fajar"];
  for (let i = 0; i < names.length; i++) {
    const start = between(r, 1, Math.max(2, months - 2));
    const repays: number[] = [];
    let at = start + between(r, 2, 5);
    while (at < months && repays.length < between(r, 1, 3)) {
      repays.push(at);
      at += between(r, 2, 4);
    }
    plans.push({
      contactName: names[i],
      kind: r() < 0.4 ? "debt" : "give",
      amount: between(r, 1_000_000, 5_000_000),
      start,
      repays,
    });
  }

  const txns: NewTx[] = [];
  const transferRows: NewTransfer[] = [];
  const transferTxIds: NewTx[] = [];
  const ledger = new Map<string, number>(); // key `${contact}:${give|debt}` -> remaining

  const spend = (key: string, amount: number) => {
    const a = acct.get(key)!;
    const spent = Math.max(0, Math.min(amount, a.balance));
    a.balance -= spent;
    return spent;
  };
  const push = (t: NewTx) => txns.push(t);

  for (let m = 0; m < months; m++) {
    const { y, mo } = ym(m, thisYear, thisMonth);

    // Salary (12th) + Feb/Dec yearly bump + THR in Dec.
    const salary = between(r, 12_900_000, 13_100_000);
    acct.get("BCA")!.balance += salary;
    push({
      userId: uid,
      accountId: acct.get("BCA")!.id,
      type: "INCOME",
      amount: salary,
      categoryId: cat.get("Gaji") ?? null,
      transactionDate: atDay(y, mo, 12),
      description: `Gaji ${MONTH_NAMES[mo]} ${y}`,
    });
    if (mo === 11) {
      acct.get("BCA")!.balance += 5_000_000;
      push({
        userId: uid,
        accountId: acct.get("BCA")!.id,
        type: "INCOME",
        amount: 5_000_000,
        categoryId: cat.get("Pendapatan Lain") ?? null,
        transactionDate: atDay(y, mo, 20),
        description: `THR ${y}`,
      });
    }

    // Bills + subscriptions (GoPay).
    const bills: Array<[string, string, number, number, number]> = [
      ["Listrik", "Listrik", 250_000, 500_000, 5],
      ["Air", "Air", 40_000, 80_000, 8],
      ["Internet", "Internet", 350_000, 350_000, 15],
      ["Gas", "Gas", 60_000, 120_000, 10],
      ["Streaming", "Streaming", 60_000, 60_000, 21],
    ];
    for (const [catName, desc, lo, hi, day] of bills) {
      const amount = spend("GoPay", between(r, lo, hi));
      if (amount > 0) {
        push({
          userId: uid,
          accountId: acct.get("GoPay")!.id,
          type: "EXPENSE",
          amount,
          categoryId: cat.get(catName) ?? null,
          transactionDate: atDay(y, mo, day),
          description: desc,
        });
      }
    }

    // Daily discretionary, envelope-budgeted per month.
    const envelope = Math.round((salary * 0.17) / 1_000) * 1_000;
    const dayBudget = Math.round(envelope / 28);
    const catPool: Array<[string, number, string[]]> = [
      ["Makan", 30, ["Makan siang", "Makan malam", "Nasi padang", "Ayam geprek", "Bakso"]],
      ["Kopi", 10, ["Kopi susu", "Latte", "Es kopi"]],
      ["Delivery", 12, ["GoFood", "GrabFood"]],
      ["Transport Online", 14, ["Gojek", "Grab"]],
      ["BBM", 20, ["Bensin", "Isi bensin"]],
    ];
    for (let day = 1; day <= 28; day++) {
      let remaining = Math.round((dayBudget * (0.35 + r() * 0.7)) / 1_000) * 1_000;
      while (remaining > 15_000) {
        const [catName, scale, descs] = catPool[Math.floor(r() * catPool.length)];
        const amt = Math.min(remaining, between(r, 15_000, 25_000 * (scale / 10)));
        const key = ["GoPay", "Cash", "Mandiri", "BCA", "GoPay"][Math.floor(r() * 5)];
        const spent = spend(key, amt);
        if (spent <= 0) break;
        push({
          userId: uid,
          accountId: acct.get(key)!.id,
          type: "EXPENSE",
          amount: spent,
          categoryId: cat.get(catName) ?? null,
          transactionDate: atDay(y, mo, day),
          description: descs[Math.floor(r() * descs.length)],
        });
        remaining -= spent;
      }
    }

    // Shopping (weekly-ish).
    const shopping: Array<[string, string, number]> = [
      ["Belanja Rumah", "Belanja mingguan", 350_000],
      ["Pakaian", "Beli baju", 400_000],
      ["Marketplace", "Belanja online", 300_000],
    ];
    for (const [catName, desc, max] of shopping) {
      if (r() < 0.55) continue;
      const spent = spend("BCA", between(r, 80_000, max));
      if (spent > 0) {
        push({
          userId: uid,
          accountId: acct.get("BCA")!.id,
          type: "EXPENSE",
          amount: spent,
          categoryId: cat.get(catName) ?? null,
          transactionDate: atDay(y, mo, between(r, 5, 27)),
          description: desc,
        });
      }
    }

    // Monthly transfer BCA -> GoPay.
    const tAmt = between(r, 600_000, 1_400_000);
    if (acct.get("BCA")!.balance >= tAmt + 1_500_000) {
      acct.get("BCA")!.balance -= tAmt;
      acct.get("GoPay")!.balance += tAmt;
      const tDate = atDay(y, mo, between(r, 3, 25));
      transferTxIds.push({
        userId: uid,
        accountId: acct.get("BCA")!.id,
        type: "TRANSFER",
        amount: tAmt,
        transactionDate: tDate,
        description: "Isi saldo GoPay",
      });
      transferRows.push({
        userId: uid,
        transactionId: "", // filled after insert
        sourceAccountId: acct.get("BCA")!.id,
        destinationAccountId: acct.get("GoPay")!.id,
      });
    }

    // Loans/debts: starts + repayments for this month.
    for (const p of plans) {
      if (p.start === m) {
        await ensureContact(p.contactName);
        const origin: TxType = p.kind === "give" ? "LOAN_GIVEN" : "DEBT_RECEIVED";
        const started = txns.some((t) => t.description === `${origin} ${p.contactName}`);
        if (started) continue;
        const amt = Math.min(p.amount, acct.get("BCA")!.balance);
        if (amt < 100_000) continue;
        if (p.kind === "give") acct.get("BCA")!.balance -= amt;
        else acct.get("BCA")!.balance += amt;
        ledger.set(`${p.contactName}:${p.kind}`, amt);
        push({
          userId: uid,
          accountId: acct.get("BCA")!.id,
          type: origin,
          amount: amt,
          contactId: contactIds.get(p.contactName)!,
          transactionDate: atDay(y, mo, between(r, 5, 20)),
          description: `${origin} ${p.contactName}`,
        });
      }
      if (p.repays.includes(m)) {
        const key = `${p.contactName}:${p.kind}`;
        const remaining = ledger.get(key) ?? 0;
        if (remaining <= 0) continue;
        if (p.kind === "give") {
          const pay = Math.min(remaining, Math.max(100_000, Math.round(remaining * (0.25 + r() * 0.3))));
          acct.get("BCA")!.balance += pay;
          ledger.set(key, remaining - pay);
          push({
            userId: uid,
            accountId: acct.get("BCA")!.id,
            type: "LOAN_REPAYMENT",
            amount: pay,
            contactId: contactIds.get(p.contactName)!,
            transactionDate: atDay(y, mo, between(r, 3, 25)),
            description: `${p.contactName} bayar pinjaman`,
          });
        } else {
          const pay = Math.min(remaining, acct.get("BCA")!.balance);
          if (pay <= 0) continue;
          spend("BCA", pay);
          ledger.set(key, remaining - pay);
          push({
            userId: uid,
            accountId: acct.get("BCA")!.id,
            type: "DEBT_PAYMENT",
            amount: pay,
            contactId: contactIds.get(p.contactName)!,
            transactionDate: atDay(y, mo, between(r, 3, 25)),
            description: `Bayar hutang ${p.contactName}`,
          });
        }
      }
    }
  }

  // Marker as oldest tx (first row, earliest date).
  const oldest = new Date(thisYear, thisMonth - months + 1, 1, 12);
  txns.unshift({
    userId: uid,
    accountId: acct.get("BCA")!.id,
    type: "INCOME",
    amount: 0,
    transactionDate: oldest,
    description: MARKER,
  } as NewTx);

  // Journal.
  for (let i = 0; i < txns.length; i += 400) {
    await db.insert(transactions).values(txns.slice(i, i + 400));
  }
  for (let i = 0; i < transferTxIds.length; i++) {
    const [tx] = await db.insert(transactions).values(transferTxIds[i]).returning();
    await db.insert(transfers).values({ ...transferRows[i], transactionId: tx.id });
  }

  for (const key of ledger.keys()) {
    const [name, kind] = key.split(":") as [string, "give" | "debt"];
    await syncLoanLedger(uid, contactIds.get(name)!, kind === "give" ? "LOAN_GIVEN" : "DEBT_RECEIVED");
  }

  const budgetCats = ["Makan", "BBM", "Belanja Rumah", "Marketplace"].filter((n) => cat.has(n));
  if (budgetCats.length) {
    const rows: Array<typeof budgets.$inferInsert> = [];
    for (let m = 0; m < months; m++) {
      const { y, mo } = ym(m, thisYear, thisMonth);
      for (const name of budgetCats) {
        rows.push({
          userId: uid,
          categoryId: cat.get(name)!,
          amount: between(r, 1_000_000, 2_500_000),
          month: `${y}-${String(mo + 1).padStart(2, "0")}`,
        });
      }
    }
    for (let i = 0; i < rows.length; i += 100) await db.insert(budgets).values(rows.slice(i, i + 100));
  }

  /* Verify */
  const { accounts: balRecords, totalActiveBalance } = await getBalances(uid);
  const negatives = balRecords.filter((a) => a.balance < 0);
  const summary = await getLoanSummary(uid);
  const totalTx = (await db.query.transactions.findMany({ where: eq(transactions.userId, uid), columns: { id: true } })).length;

  console.log("SEED HISTORY COMPLETE");
  console.log(`  months: ${months} · seed: ${seed} · email: ${email}`);
  console.log(`  transactions: ${totalTx}`);
  console.log(
    `  balances: ${balRecords.map((a) => `${a.name} ${a.balance.toLocaleString("id-ID")}`).join(" · ")}`
  );
  console.log(`  total active: ${totalActiveBalance.toLocaleString("id-ID")}`);
  console.log(
    `  piutang: ${summary.totalPiutang.toLocaleString("id-ID")} · hutang: ${summary.totalHutang.toLocaleString("id-ID")}`
  );
  if (negatives.length) {
    console.error("NEGATIVE BALANCES:", negatives.map((a) => a.name).join(", "));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});