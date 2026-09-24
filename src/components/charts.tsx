import { formatRp } from "@/lib/format";

export const PALETTE = ["#059669", "#0d9488", "#0284c7", "#7c3aed", "#db2777", "#ea580c", "#ca8a04", "#64748b"];

export const CASH_COLORS = { income: "#059669", expense: "#ef4444", net: "#2563eb" };

/** Compact rupiah for tight chart labels: Rp850rb, Rp2,1jt. */
export function formatCompact(n: number): string {
  return "Rp" + new Intl.NumberFormat("id-ID", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export type LineSeries = { name: string; color: string; values: number[] };

export function LineChart({
  xLabels,
  series,
  height = 150,
}: {
  xLabels: string[];
  series: LineSeries[];
  height?: number;
}) {
  const W = 320;
  const H = height;
  const padL = 6;
  const padR = 6;
  const padT = 10;
  const padB = 20;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const n = xLabels.length;
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const x = (i: number) => (n <= 1 ? padL + plotW / 2 : padL + (i * plotW) / (n - 1));
  const y = (v: number) => padT + plotH - (v / max) * plotH;
  const path = (values: number[]) => values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(v)}`).join(" ");

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Line chart">
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line
            key={f}
            x1={padL}
            x2={W - padR}
            y1={padT + plotH * (1 - f)}
            y2={padT + plotH * (1 - f)}
            stroke="#f0f0f0"
            strokeWidth="1"
          />
        ))}
        {series.map((s) => (
          <g key={s.name}>
            <path d={path(s.values)} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            {s.values.map((v, i) => (
              <circle key={i} cx={x(i)} cy={y(v)} r="2.5" fill={s.color} />
            ))}
          </g>
        ))}
        {xLabels.map((l, i) => (
          <text key={l} x={x(i)} y={H - 6} fontSize="8" textAnchor="middle" fill="#a3a3a3">
            {l}
          </text>
        ))}
      </svg>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {series.map((s) => (
          <span key={s.name} className="flex items-center gap-1.5 text-xs text-neutral-500">
            <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
            {s.name}
            <span className="font-semibold text-neutral-700">
              {formatRp(s.values.length ? s.values[s.values.length - 1] : 0)}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function WeekdayBars({ totals, labels }: { totals: number[]; labels: string[] }) {
  const W = 320;
  const H = 120;
  const padT = 14;
  const padB = 18;
  const plotH = H - padT - padB;
  const max = Math.max(1, ...totals);
  const n = totals.length;
  const slot = W / n;
  const barW = Math.min(26, slot * 0.55);
  const x = (i: number) => slot * i + (slot - barW) / 2;
  const y = (v: number) => padT + plotH - (v / max) * plotH;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Pengeluaran per hari dalam seminggu">
        {totals.map((v, i) => (
          <g key={labels[i]}>
            {v > 0 && (
              <text x={x(i) + barW / 2} y={y(v) - 3} fontSize="7" textAnchor="middle" fill="#737373">
                {formatCompact(v)}
              </text>
            )}
            <rect
              x={x(i)}
              y={y(v)}
              width={barW}
              height={Math.max(v > 0 ? plotH - (y(v) - padT) : 1, v > 0 ? 1 : 1)}
              rx="2"
              fill={v === max && v > 0 ? "#059669" : "#e5e5e5"}
            />
            <text x={x(i) + barW / 2} y={H - 6} fontSize="8" textAnchor="middle" fill="#a3a3a3">
              {labels[i]}
            </text>
          </g>
        ))}
      </svg>
      <p className="mt-1 text-xs text-neutral-400">Hari dengan pengeluaran terbesar disorot.</p>
    </div>
  );
}