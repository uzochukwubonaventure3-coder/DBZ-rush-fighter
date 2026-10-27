/** Dependency-free SVG charts: server-rendered, zero client JS, small payload. */
interface Series { label: string; color: string; values: (number | null)[] }

export function LineChart({ series, labels, min, max, format = (n: number) => String(Math.round(n * 100) / 100), height = 180, ariaLabel }:
  { series: Series[]; labels: string[]; min?: number; max?: number; format?: (n: number) => string; height?: number; ariaLabel: string }) {
  const W = 640, H = height, L = 46, R = 12, T = 12, B = 24;
  const all = series.flatMap((s) => s.values.filter((v): v is number => v !== null));
  if (all.length === 0) return <p className="text-sm text-slate-500">Not enough data yet.</p>;
  let lo = min ?? Math.min(...all), hi = max ?? Math.max(...all);
  if (hi - lo < 1e-9) { lo -= 1; hi += 1; }
  const n = Math.max(...series.map((s) => s.values.length));
  const x = (i: number) => (n <= 1 ? (L + W - R) / 2 : L + (i * (W - L - R)) / (n - 1));
  const y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const ticks = [lo, (lo + hi) / 2, hi];
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={ariaLabel}>
        {ticks.map((t, i) => (<g key={i}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="#232738" /><text x={L - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#94a3b8">{format(t)}</text></g>))}
        {series.map((s) => {
          const segs: string[][] = [[]];
          s.values.forEach((v, i) => { if (v === null) segs.push([]); else segs[segs.length - 1].push(`${x(i)},${y(v)}`); });
          return <g key={s.label}>
            {segs.filter((p) => p.length > 1).map((p, i) => <polyline key={i} points={p.join(' ')} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinejoin="round" />)}
            {s.values.map((v, i) => v === null ? null : <circle key={i} cx={x(i)} cy={y(v)} r="3.5" fill={s.color}><title>{`${s.label}: ${format(v)} (${labels[i] ?? ''})`}</title></circle>)}
          </g>;
        })}
        <text x={L} y={H - 6} fontSize="11" fill="#94a3b8">{labels[0] ?? ''}</text>
        <text x={W - R} y={H - 6} fontSize="11" fill="#94a3b8" textAnchor="end">{labels[labels.length - 1] ?? ''}</text>
      </svg>
      {series.length > 1 && <figcaption className="mt-1 flex flex-wrap gap-4 text-xs text-slate-400">{series.map((s) => <span key={s.label}><span aria-hidden style={{ background: s.color }} className="mr-1 inline-block h-2 w-2 rounded-full" />{s.label}</span>)}</figcaption>}
    </figure>
  );
}

export function PairedBars({ data, ariaLabel }: { data: { startSec: number; you: number; opponent: number }[]; ariaLabel: string }) {
  const W = 640, H = 150, L = 28, B = 22, T = 8;
  const peak = Math.max(1, ...data.flatMap((d) => [d.you, d.opponent]));
  const slot = (W - L - 8) / Math.max(data.length, 1), bw = Math.max(2, Math.min(14, slot / 2.6));
  const h = (v: number) => (v / peak) * (H - T - B);
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={ariaLabel}>
        <line x1={L} x2={W - 8} y1={H - B} y2={H - B} stroke="#343a52" />
        <text x={L - 4} y={T + 8} textAnchor="end" fontSize="10" fill="#94a3b8">{peak}</text>
        {data.map((d, i) => { const cx = L + slot * i + slot / 2; return <g key={i}>
          <rect x={cx - bw - 1} y={H - B - h(d.you)} width={bw} height={h(d.you)} fill="#ff9419"><title>{`${d.startSec}s: you ${d.you}`}</title></rect>
          <rect x={cx + 1} y={H - B - h(d.opponent)} width={bw} height={h(d.opponent)} fill="#38bdf8"><title>{`${d.startSec}s: opponent ${d.opponent}`}</title></rect>
          {(i % Math.ceil(data.length / 8) === 0) && <text x={cx} y={H - 6} textAnchor="middle" fontSize="10" fill="#94a3b8">{d.startSec}s</text>}
        </g>; })}
      </svg>
      <figcaption className="mt-1 flex gap-4 text-xs text-slate-400"><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-ember-500" />You</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-sky-400" />Opponent</span><span>attack presses per 5 seconds</span></figcaption>
    </figure>
  );
}
