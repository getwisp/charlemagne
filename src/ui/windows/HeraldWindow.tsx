import type { HeraldMessage } from '../../engine';
import { useGame } from '../context';

const ICON = { info: 'ℹ️', good: '📜', warning: '⚠️', error: '⛔' } as const;

export function HeraldWindow({ read }: { read: HeraldMessage[] }) {
  const { me } = useGame();
  const report = me.lastReport;
  return (
    <div>
      {report && (
        <div className="sunken field" style={{ padding: 6, marginBottom: 6 }}>
          <b>Jahresbilanz {report.year}:</b> Steuern {report.taxIncome.toLocaleString('de-DE')}
          {report.taxIntercepted > 0 && <span className="neg"> (davon {report.taxIntercepted.toLocaleString('de-DE')} von Dieben abgefangen)</span>} · Sold {report.militaryUpkeep.toLocaleString('de-DE')} · Kredite{' '}
          {report.loanPayments.toLocaleString('de-DE')} · Saldo {report.netGold.toLocaleString('de-DE')} Taler. Bevölkerung +{report.births + report.immigrants} / −
          {report.deaths + report.starved + report.emigrants}. Ratten: {report.ratLoss.toLocaleString('de-DE')} Scheffel.
        </div>
      )}
      <div className="sunken field" style={{ maxHeight: 320, overflow: 'auto', padding: 6 }}>
        {read.length === 0 && <div className="muted">Keine Meldungen in diesem Jahr.</div>}
        {read.map((m) => (
          <div key={m.id} style={{ marginBottom: 6 }}>
            <div>
              {ICON[m.severity]} <b>{m.title}</b>
            </div>
            <div style={{ whiteSpace: 'pre-wrap', paddingLeft: 22 }}>{m.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
