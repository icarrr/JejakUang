"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { TxTypeLabel } from "@/components/tx";
import type { TxType } from "@/lib/balance";

type Opt = { id: string; name: string; icon?: string };

const TYPES: Array<{ value: TxType | ""; label: string }> = [
  { value: "", label: "Semua tipe" },
  ...(["INCOME", "EXPENSE", "TRANSFER", "LOAN_GIVEN", "LOAN_REPAYMENT", "DEBT_RECEIVED", "DEBT_PAYMENT"] as TxType[]).map(
    (t) => ({ value: t, label: TxTypeLabel(t) })
  ),
];

export function TxFilters({
  accounts,
  categories,
}: {
  accounts: Opt[];
  categories: Opt[];
}) {
  const router = useRouter();
  const sp = useSearchParams();

  const [q, setQ] = useState(sp.get("q") ?? "");
  const [from, setFrom] = useState(sp.get("from") ?? "");
  const [to, setTo] = useState(sp.get("to") ?? "");
  const [account, setAccount] = useState(sp.get("account") ?? "");
  const [category, setCategory] = useState(sp.get("category") ?? "");
  const [type, setType] = useState(sp.get("type") ?? "");
  const [min, setMin] = useState(sp.get("min") ?? "");
  const [max, setMax] = useState(sp.get("max") ?? "");

  function apply() {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    if (account) p.set("account", account);
    if (category) p.set("category", category);
    if (type) p.set("type", type);
    if (min) p.set("min", min.replace(/[^\d]/g, ""));
    if (max) p.set("max", max.replace(/[^\d]/g, ""));
    router.push(`/transactions${p.toString() ? `?${p}` : ""}`);
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-neutral-500">Cari</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="🔍 deskripsi, kategori, akun…"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-600"
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-neutral-500">Dari</span>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-2 py-2 text-sm outline-none focus:border-emerald-600"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-neutral-500">Sampai</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-2 py-2 text-sm outline-none focus:border-emerald-600"
            />
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-neutral-500">Akun</span>
          <select
            value={account}
            onChange={(e) => setAccount(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-2 py-2 text-sm outline-none focus:border-emerald-600"
          >
            <option value="">Semua akun</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-neutral-500">Kategori</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-2 py-2 text-sm outline-none focus:border-emerald-600"
          >
            <option value="">Semua kategori</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon ? `${c.icon} ` : ""}
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-neutral-500">Tipe</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-2 py-2 text-sm outline-none focus:border-emerald-600"
          >
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-neutral-500">Min</span>
            <input
              inputMode="numeric"
              value={min}
              onChange={(e) => setMin(e.target.value.replace(/[^\d]/g, ""))}
              placeholder="0"
              className="w-full rounded-lg border border-neutral-300 px-2 py-2 text-sm outline-none focus:border-emerald-600"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-neutral-500">Max</span>
            <input
              inputMode="numeric"
              value={max}
              onChange={(e) => setMax(e.target.value.replace(/[^\d]/g, ""))}
              placeholder="∞"
              className="w-full rounded-lg border border-neutral-300 px-2 py-2 text-sm outline-none focus:border-emerald-600"
            />
          </label>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          onClick={apply}
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
        >
          Terapkan
        </button>
        <Link
          href="/transactions"
          className="rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium hover:bg-neutral-50"
        >
          Reset
        </Link>
      </div>
    </div>
  );
}