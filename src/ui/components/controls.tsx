import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

export function GroupBox({ label, children }: { label: string; children: ReactNode }) {
  return (
    <fieldset className="groupbox">
      <legend>{label}</legend>
      {children}
    </fieldset>
  );
}

const BLOCK = 10; // Blockbreite inkl. Lücke, passend zum Streifenmuster in .progress-fill

/** Win95-Fortschrittsbalken: füllt sich in ganzen Blöcken. */
export function Progress({ value, done }: { value: number; done?: boolean }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  const ref = useRef<HTMLDivElement>(null);
  const [inner, setInner] = useState(0);
  useLayoutEffect(() => {
    if (ref.current) setInner(ref.current.clientWidth - 4);
  }, []);
  const width = inner > 0 ? (pct >= 100 ? inner : Math.floor(((pct / 100) * inner) / BLOCK) * BLOCK) : undefined;
  return (
    <div ref={ref} className="progress sunken" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className={`progress-fill ${done ? 'done' : ''}`} style={{ width: width ?? `${pct}%` }} />
    </div>
  );
}

interface NumberFieldProps {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  width?: number;
  label?: string;
}

export function NumberField({ value, onChange, min = 0, max, step = 1, width, label }: NumberFieldProps) {
  return (
    <input
      className="input"
      type="number"
      aria-label={label}
      value={Number.isFinite(value) ? value : 0}
      min={min}
      max={max}
      step={step}
      style={width ? { width } : undefined}
      onChange={(e) => {
        const v = Number(e.target.value);
        onChange(Number.isFinite(v) ? Math.max(min, max !== undefined ? Math.min(max, v) : v) : 0);
      }}
    />
  );
}

export function Tabs<T extends string>({ tabs, active, onChange }: { tabs: { id: T; label: string }[]; active: T; onChange: (id: T) => void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={t.id === active} className={`tab ${t.id === active ? 'active' : ''}`} onClick={() => onChange(t.id)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Money({ value, signed }: { value: number; signed?: boolean }) {
  const v = Math.round(value) || 0; // keine „-0“
  const cls = signed ? (v > 0 ? 'pos' : v < 0 ? 'neg' : '') : v < 0 ? 'neg' : '';
  return <span className={cls}>{(signed && v > 0 ? '+' : '') + v.toLocaleString('de-DE')}</span>;
}

export function n(v: number): string {
  return (Math.round(v) || 0).toLocaleString('de-DE');
}
