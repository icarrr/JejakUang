import assert from "node:assert/strict";
import { buildInsights, comparePeriods } from "./insights";

const cur = { income: 8_500_000, expense: 6_200_000, net: 2_300_000 };
const prev = { income: 7_000_000, expense: 5_740_740, net: 1_259_260 };

// PRD #9: expense increased → factual, non-judgmental wording.
const up = buildInsights({ cur, prev, topCategory: { name: "Food", total: 2_100_000 }, unit: "bulan ini", unitPrev: "bulan lalu" });
assert.ok(up.some((s) => s.startsWith("Pengeluaran naik Rp")), "expense-up insight expected");
assert.ok(up.some((s) => s.includes("Food") && s.includes("terbesar")), "top category insight expected");
assert.ok(up.some((s) => s.startsWith("Net cash flow bulan ini positif")), "positive net flow insight");
assert.ok(!up.some((s) => s.includes("boros")), "no judgmental wording");

// Downward expense + negative net flow.
const down = buildInsights({
  cur: { income: 5_000_000, expense: 6_000_000, net: -1_000_000 },
  prev: { income: 5_000_000, expense: 5_000_000, net: 0 },
  topCategory: null,
  unit: "bulan ini",
  unitPrev: "bulan lalu",
});
assert.ok(down.some((s) => s.startsWith("Pengeluaran naik")), "expense up vs prev");
assert.ok(down.some((s) => s.includes("lebih besar daripada pemasukan sebesar Rp1.000.000")), "negative net flow insight");
assert.ok(!down.some((s) => s.includes("Pemasukan")), "income unchanged → no income line");

// No data → empty-state copy.
const empty = buildInsights({
  cur: { income: 0, expense: 0, net: 0 },
  prev: { income: 0, expense: 0, net: 0 },
  topCategory: null,
  unit: "bulan ini",
  unitPrev: "bulan lalu",
});
assert.equal(empty.length, 1);
assert.ok(empty[0].includes("Belum cukup data"), "no-data insight expected");

// comparePeriods: pct null when prev is 0; diff math correct.
const d = comparePeriods(cur, prev);
assert.equal(d.incomeDiff, 1_500_000);
assert.equal(d.incomePct, Math.round((1_500_000 / 7_000_000) * 100));
assert.equal(comparePeriods(cur, { income: 0, expense: 0, net: 0 }).expensePct, null);
assert.equal(comparePeriods(cur, { income: 0, expense: 0, net: 0 }).expenseDiff, 6_200_000);

// Equal income → no delta line; pct 0 when prev>0 equal.
const equal = buildInsights({
  cur,
  prev: { income: 8_500_000, expense: 6_200_000, net: 2_300_000 },
  topCategory: null,
  unit: "bulan ini",
  unitPrev: "bulan lalu",
});
assert.ok(!equal.some((s) => s.startsWith("Pengeluaran") && s.includes("dibanding")), "no delta when equal");
assert.equal(comparePeriods(cur, cur).incomePct, 0);

console.log("insights self-check: OK");