import { useMemo, useState } from 'react';
import { PixelIcon, type IconName } from './icons';

const COLS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
const ROWS = 32;
const REGIONS = ['Nord', 'Süd', 'West', 'Ost', 'Zentrale', 'Export', 'Online', 'Filialen'];

/** Boss-Taste: verwandelt das Spielfeld in eine täuschend echte Tabellenkalkulation. */
export function BossScreen({ onExit }: { onExit: () => void }) {
  const [sel, setSel] = useState<[number, number]>([4, 2]);
  const data = useMemo(() => {
    const rows: (string | number)[][] = [];
    let seed = 1998;
    const rnd = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    rows.push(['Quartalsbericht Vertrieb 1998', '', '', '', '', '', '', '', '', '']);
    rows.push(['Angaben in TDM', '', '', '', '', '', '', '', '', '']);
    rows.push(['', '', '', '', '', '', '', '', '', '']);
    rows.push(['Region', 'Q1', 'Q2', 'Q3', 'Q4', 'Summe', 'Plan', 'Abw. %', 'Vorjahr', 'Trend']);
    for (const r of REGIONS) {
      const q = [0, 1, 2, 3].map(() => Math.round(800 + rnd() * 2400));
      const sum = q.reduce((a, b) => a + b, 0);
      const plan = Math.round(sum * (0.9 + rnd() * 0.2));
      const prev = Math.round(sum * (0.85 + rnd() * 0.25));
      rows.push([r, ...q, sum, plan, (((sum - plan) / plan) * 100).toFixed(1).replace('.', ','), prev, sum >= prev ? '▲' : '▼']);
    }
    const body = rows.slice(4);
    const totals = [1, 2, 3, 4, 5, 6].map((c) => body.reduce((a, r) => a + (r[c] as number), 0));
    rows.push(['Gesamt', ...totals, '', body.reduce((a, r) => a + (r[8] as number), 0), '']);
    while (rows.length < ROWS) rows.push(COLS.map(() => ''));
    return rows;
  }, []);

  const cellName = `${COLS[sel[1]]}${sel[0] + 1}`;
  const cellValue = data[sel[0]]?.[sel[1]] ?? '';
  const fmt = (v: string | number) => (typeof v === 'number' ? v.toLocaleString('de-DE') : v);
  const formula = sel[1] === 5 && sel[0] >= 4 && sel[0] < 12 ? `=SUMME(B${sel[0] + 1}:E${sel[0] + 1})` : fmt(cellValue);

  return (
    <div className="boss" role="application" aria-label="Tabellenkalkulation">
      <div className="xl-title titlebar">
        <PixelIcon name="spreadsheet" />
        <span style={{ flex: 1 }}>Tabellenkalkulation - Quartalsbericht_Q4_final_v3.xls</span>
        <button className="btn tb-btn" onClick={onExit} aria-label="Schließen" title="Zurück (Esc)">
          ✕
        </button>
      </div>
      <div className="menubar">
        {['Datei', 'Bearbeiten', 'Ansicht', 'Einfügen', 'Format', 'Extras', 'Daten', 'Fenster', '?'].map((m) => (
          <span key={m}>{m}</span>
        ))}
      </div>
      <div className="xl-toolbar">
        {(['page', 'folder', 'disk', 'printer', 'scissors'] as IconName[]).map((name) => (
          <span key={name} className="raised">
            <PixelIcon name={name} />
          </span>
        ))}
        {['↶', 'Σ', 'ƒ', '↓A', '%', ',0'].map((t) => (
          <span key={t} className="raised">
            {t}
          </span>
        ))}
        <span className="raised">
          <PixelIcon name="stats" />
        </span>
        <select className="input" style={{ marginLeft: 8 }} defaultValue="Arial" aria-label="Schriftart">
          <option>Arial</option>
        </select>
        <select className="input" defaultValue="10" aria-label="Schriftgröße">
          <option>10</option>
        </select>
      </div>
      <div className="xl-formula">
        <div className="input" style={{ width: 70 }}>
          {cellName}
        </div>
        <span>=</span>
        <div className="input" style={{ flex: 1 }}>
          {formula}
        </div>
      </div>
      <div className="xl-grid sunken">
        <table>
          <thead>
            <tr>
              <th />
              {COLS.map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, r) => (
              <tr key={r}>
                <th>{r + 1}</th>
                {row.map((v, c) => (
                  <td
                    key={c}
                    className={`${typeof v === 'number' ? 'n' : ''} ${r === 0 || r === 3 || row[0] === 'Gesamt' ? 'b' : ''} ${sel[0] === r && sel[1] === c ? 'sel' : ''}`}
                    onClick={() => setSel([r, c])}
                  >
                    {fmt(v)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="xl-sheets">
        <span className="on">Tabelle1</span>
        <span>Tabelle2</span>
        <span>Tabelle3</span>
      </div>
      <div className="statusline">
        <div className="sunken">Bereit</div>
        <div className="sunken" style={{ flex: '0 0 160px' }}>
          Summe={typeof cellValue === 'number' ? cellValue.toLocaleString('de-DE') : '0'}
        </div>
        <div className="sunken" style={{ flex: '0 0 60px' }}>
          NF
        </div>
      </div>
    </div>
  );
}
