import assert from "node:assert/strict";
import { computeBalances } from "./balance";

// PRD #10 example: BCA 5jt -> salary +10jt -> food -500k -> transfer -1jt to GoPay
// BCA end: 13.5jt. GoPay end: 1jt. Total: 14.5jt.
const accounts = [
  { id: "bca", initialBalance: 5_000_000 },
  { id: "gopay", initialBalance: 0 },
];

const txns = [
  { id: "t1", accountId: "bca", type: "INCOME" as const, amount: 10_000_000 },
  { id: "t2", accountId: "bca", type: "EXPENSE" as const, amount: 500_000 },
  { id: "t3", accountId: "bca", type: "TRANSFER" as const, amount: 1_000_000 },
];

const transfers = [{ transactionId: "t3", destinationAccountId: "gopay" }];

const b = computeBalances(accounts, txns, transfers);

assert.equal(b.get("bca"), 13_500_000, "BCA balance should be 13.5jt");
assert.equal(b.get("gopay"), 1_000_000, "GoPay balance should be 1jt");
assert.equal([...b.values()].reduce((a, c) => a + c, 0), 14_500_000, "total unchanged by transfer");

// Transfer must NOT count as expense: without it, BCA = 14.5jt
const noTransfer = computeBalances(accounts, txns.slice(0, 2), []);
assert.equal(noTransfer.get("bca"), 14_500_000);

// PRD #43/#45: loan/debt types move real money but are NOT expense/income.
// BCA 5jt -> loan given 500k -> repayment 200k -> debt received 1jt -> debt payment 300k
const loanTxns: Array<{ id: string; accountId: string; type: "INCOME" | "EXPENSE" | "TRANSFER" | "LOAN_GIVEN" | "LOAN_REPAYMENT" | "DEBT_RECEIVED" | "DEBT_PAYMENT"; amount: number }> = [
  { id: "l1", accountId: "bca", type: "LOAN_GIVEN", amount: 500_000 },
  { id: "l2", accountId: "bca", type: "LOAN_REPAYMENT", amount: 200_000 },
  { id: "l3", accountId: "bca", type: "DEBT_RECEIVED", amount: 1_000_000 },
  { id: "l4", accountId: "bca", type: "DEBT_PAYMENT", amount: 300_000 },
];
const lb = computeBalances(accounts, loanTxns, []);
assert.equal(lb.get("bca"), 5_000_000 - 500_000 + 200_000 + 1_000_000 - 300_000, "loan/debt net effect on account");
assert.equal(lb.get("gopay"), 0);

console.log("balance self-check: OK");