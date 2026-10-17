import { useState } from 'react';
import type { HistoryEntry } from '../../engine';
import { n } from '../components/controls';
import { useGame } from '../context';

type Metric = 'population' | 'gold' | 'land' | 'grain';
const METRICS: Record<Metric, { label: string; unit: string; color: string }> = {
  population: { label: 'Bevölkerung', unit: 'Bürger', color: '#000080' },
  gold: { label: 'Staatskasse', unit: 'Taler (inkl. Sparkonto)', color: '#806000' },
  land: { label: 'Land', unit: 'Hektar', color: '#006000' },
  grain: { label: 'Kornvorrat', unit: 'Scheffel', color: '#800000' },
};

/** Klickbare Graphen: Verlauf der letzten 10 Runden. */
export function StatsWindow() {
  const { me } = useGame();
  const [metric, setMetric] = useState<Metric>('population');
  const [hover, setHover] = useState<number | null>(null);
  const data: HistoryEntry[] = me.history.slice(-10);
  const values = data.map((d) => d[metric]);
  // Achse auf runde Werte um den Datenbereich legen, damit auch kleine Trends sichtbar werden.
  const [min, max, step] = niceRange(values.length ? Math.min(...values) : 0, values.length ? Math.max(...values) : 1);
  const W = 480;
  const H = 220;
  const pad = { l: 60, r: 22, t: 12, b: 26 };
  const x = (i: number) => pad.l + (data.length <= 1 ? 0 : (i * (W - pad.l - pad.r)) / (data.length - 1));
  const y = (v: number) => pad.t + (1 - (v - min) / (max - min || 1)) * (H - pad.t - pad.b);
  const path = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const ticks = Array.from({ length: Math.round((max - min) / step) + 1 }, (_, i) => min + i * step);
  const m = METRICS[metric];

  return (
    <div>
      <div className="chart-tabs">
        {(Object.keys(METRICS) as Metric[]).map((k) => (
          <button key={k} className={`btn small ${metric === k ? 'pressed' : ''}`} onClick={() => setMetric(k)}>
            {METRICS[k].label}
          </button>
        ))}
      </div>
      {data.length === 0 ? (
        <div className="sunken field" style={{ padding: 20, textAlign: 'center' }}>
          Noch keine Daten – der Verlauf erscheint nach dem ersten Jahreswechsel.
        </div>
      ) : (
      <div className="sunken">
        <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${m.label} der letzten ${data.length} Jahre`} onMouseLeave={() => setHover(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="#d0d0d0" strokeDasharray="2 2" />
              <text x={pad.l - 4} y={y(t) + 4} fontSize="10" textAnchor="end" fill="#404040">
                {n(t)}
              </text>
            </g>
          ))}
          {data.map((d, i) => (
            <text key={d.year} x={x(i)} y={H - 8} fontSize="10" textAnchor="middle" fill="#404040">
              {d.year}
            </text>
          ))}
          <path d={path} fill="none" stroke={m.color} strokeWidth={2} />
          {values.map((v, i) => (
            <g key={i} onMouseEnter={() => setHover(i)} onClick={() => setHover(i)} style={{ cursor: 'pointer' }}>
              <circle cx={x(i)} cy={y(v)} r={hover === i ? 5 : 3} fill={hover === i ? m.color : '#fff'} stroke={m.color} strokeWidth={2} />
              <rect x={x(i) - 12} y={pad.t} width={24} height={H - pad.t - pad.b} fill="transparent" />
            </g>
          ))}
        </svg>
      </div>
      )}
      <div className="statusline">
        <div className="sunken">
          {hover !== null && data[hover] ? `Anno ${data[hover].year}: ${n(values[hover])} ${m.unit}` : `${m.label} – Punkt anklicken für Details`}
        </div>
      </div>
    </div>
  );
}

/** Runde Achsengrenzen und Schrittweite (1, 2, 2,5 oder 5 × 10ⁿ) für etwa 4–6 Hilfslinien. */
function niceRange(lo: number, hi: number): [number, number, number] {
  if (!Number.isFinite(lo)) lo = 0;
  if (hi - lo < 1) {
    hi += 1;
    lo = Math.max(0, lo - 1);
  }
  const span = hi - lo;
  // Unten etwas Luft lassen, aber nicht unter 0
  lo = Math.max(0, lo - span * 0.15);
  const raw = (hi - lo) / 5;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((x) => x >= raw) ?? 10 * mag;
  return [Math.floor(lo / step) * step, Math.ceil(hi / step) * step, step];
}
