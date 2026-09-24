import { monthKey, monthLabel } from "@/lib/format";

export type Preset = "this_month" | "last_month" | "3m" | "6m" | "12m" | "this_year" | "custom";

export type DateRange = { from: Date; to: Date; preset: Preset };

export const PRESETS: Array<{ key: Preset; label: string }> = [
  { key: "this_month", label: "Bulan Ini" },
  { key: "last_month", label: "Bulan Lalu" },
  { key: "3m", label: "3 Bulan" },
  { key: "6m", label: "6 Bulan" },
  { key: "12m", label: "12 Bulan" },
  { key: "this_year", label: "Tahun Ini" },
];

const DAY = 86_400_000;

/** First day of the month containing d, local time. */
function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** Range described by a preset. `to` is exclusive. */
export function presetRange(p: Preset, now = new Date()): DateRange {
  const cur = startOfMonth(now);
  switch (p) {
    case "this_month":
      return { from: cur, to: new Date(cur.getFullYear(), cur.getMonth() + 1, 1), preset: p };
    case "last_month":
      return { from: new Date(cur.getFullYear(), cur.getMonth() - 1, 1), to: cur, preset: p };
    case "3m":
    case "6m":
    case "12m": {
      const back = p === "3m" ? 2 : p === "6m" ? 5 : 11;
      return {
        from: new Date(cur.getFullYear(), cur.getMonth() - back, 1),
        to: new Date(cur.getFullYear(), cur.getMonth() + 1, 1),
        preset: p,
      };
    }
    case "this_year":
      return { from: new Date(cur.getFullYear(), 0, 1), to: new Date(cur.getFullYear() + 1, 0, 1), preset: p };
    case "custom":
      return { from: cur, to: new Date(cur.getFullYear(), cur.getMonth() + 1, 1), preset: p };
  }
}

function parseDateInput(s: string | undefined): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return new Date(y, m - 1, d);
}

/**
 * Resolve URL params into a range. Priority: preset (`?p=`), then legacy
 * single month (`?m=YYYY-MM`), then custom (`?from=YYYY-MM-DD&to=YYYY-MM-DD`).
 * Defaults to this month.
 */
export function parseRange(
  params: { p?: string; m?: string; from?: string; to?: string },
  now = new Date()
): DateRange {
  const p = PRESETS.some((x) => x.key === params.p) ? (params.p as Preset) : null;
  if (p) return presetRange(p, now);

  if (params.m && /^\d{4}-\d{2}$/.test(params.m)) {
    const [y, m] = params.m.split("-").map(Number);
    return { from: new Date(y, m - 1, 1), to: new Date(y, m, 1), preset: "custom" };
  }

  const from = parseDateInput(params.from);
  const to = parseDateInput(params.to);
  if (from && to && to > from) {
    return { from, to: new Date(to.getTime() + DAY), preset: "custom" };
  }
  return presetRange("this_month", now);
}

/** Equal-length window immediately before `r` — for "vs previous period". */
export function prevRange(r: DateRange): DateRange {
  const len = r.to.getTime() - r.from.getTime();
  return { from: new Date(r.from.getTime() - len), to: r.from, preset: r.preset };
}

/** True when the range covers exactly one calendar month. */
export function isSingleMonth(r: DateRange): boolean {
  return monthKey(r.from) === monthKey(new Date(r.to.getTime() - DAY));
}

const monthShort = (d: Date) =>
  d.toLocaleDateString("id-ID", { month: "short" }).replace(".", "");
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Human label: "September 2026", "Agu – Okt 2026", or "12 Mei – 24 Sep 2026". */
export function rangeLabel(r: DateRange): string {
  if (isSingleMonth(r)) {
    const [y, m] = monthKey(r.from).split("-").map(Number);
    return monthLabel(`${y}-${String(m).padStart(2, "0")}`);
  }
  const end = new Date(r.to.getTime() - DAY);
  const aligned = r.from.getDate() === 1 && end.getDate() === new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate();
  const sameYear = r.from.getFullYear() === end.getFullYear();
  if (aligned) {
    return sameYear
      ? `${capital(monthShort(r.from))} – ${capital(monthShort(end))} ${end.getFullYear()}`
      : `${capital(monthShort(r.from))} ${r.from.getFullYear()} – ${capital(monthShort(end))} ${end.getFullYear()}`;
  }
  const fmt = (d: Date) => d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  return `${fmt(r.from)} – ${fmt(end)}`;
}

/** Month keys between from and to (both inclusive of the start month), ascending. */
export function monthsBetween(r: DateRange): string[] {
  const keys: string[] = [];
  const cur = new Date(r.from.getFullYear(), r.from.getMonth(), 1);
  const last = new Date(r.to.getFullYear(), r.to.getMonth(), 1);
  let guard = 0;
  while (cur <= last && guard < 120) {
    keys.push(monthKey(cur));
    cur.setMonth(cur.getMonth() + 1);
    guard++;
  }
  return keys;
}