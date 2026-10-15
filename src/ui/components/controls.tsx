import type { ReactNode } from 'react';

export function GroupBox({ label, children }: { label: string; children: ReactNode }) {
  return (
    <fieldset className="groupbox">
      <legend>{label}</legend>
      {children}
    </fieldset>
  );
}

export function Progress({ value, done }: { value: number; done?: boolean }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className="progress sunken" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className={`progress-fill ${done ? 'done' : ''}`} style={{ width: `${pct}%` }} />
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
  const v = Math.round(value);
  const cls = signed ? (v > 0 ? 'pos' : v < 0 ? 'neg' : '') : v < 0 ? 'neg' : '';
  return <span className={cls}>{(signed && v > 0 ? '+' : '') + v.toLocaleString('de-DE')}</span>;
}

export function n(v: number): string {
  return Math.round(v).toLocaleString('de-DE');
}
