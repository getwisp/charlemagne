import { actions, previewEconomy, JUSTICE_CRIME, JUSTICE_NAMES, TAX_LIMITS, type Taxes } from '../../engine';
import { GroupBox, Money, n } from '../components/controls';
import { useGame } from '../context';

const TAX_LABELS: Record<keyof Taxes, string> = { income: 'Einkommensteuer', sales: 'Mehrwertsteuer', tolls: 'Zölle' };

export function TreasuryWindow() {
  const { state, me, act, canAct } = useGame();
  const preview = previewEconomy(state, me);
  const t = preview.taxes;

  return (
    <div>
      <GroupBox label="Steuersätze">
        {(Object.keys(TAX_LABELS) as (keyof Taxes)[]).map((k) => (
          <div key={k} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 40px', alignItems: 'center', gap: 6 }}>
            <span>{TAX_LABELS[k]}</span>
            <input
              type="range"
              min={0}
              max={TAX_LIMITS[k]}
              value={me.taxes[k]}
              disabled={!canAct}
              onChange={(e) => act((s) => actions.setTaxes(s, me.id, { [k]: Number(e.target.value) }))}
              aria-label={TAX_LABELS[k]}
            />
            <b style={{ textAlign: 'right' }}>{me.taxes[k]} %</b>
          </div>
        ))}
        <div className="hint">
          Jeder Prozentpunkt kostet, und zwar zunehmend: Einkommensteuer vertreibt Bürger, hohe Mehrwertsteuer und Zölle vertreiben den Handel. Den meisten Ertrag bringen MwSt. und Zölle um 11 %
          – darüber sinkt er wieder. Die Vorschau unten zeigt die Wirkung sofort.
        </div>
      </GroupBox>

      <GroupBox label={`Justiz: ${JUSTICE_NAMES[me.justice - 1]}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }}>
          {JUSTICE_NAMES.map((name, i) => (
            <label key={name} className="check">
              <input type="radio" name="justice" checked={me.justice === i + 1} disabled={!canAct} onChange={() => act((s) => actions.setJustice(s, me.id, i + 1))} />
              {name}
            </label>
          ))}
        </div>
        <div className="hint">
          Kriminalität kostet derzeit {Math.round(JUSTICE_CRIME[me.justice - 1] * 100)} % der Steuern. Harte Justiz senkt Kriminalität und stärkt die Garde gegen Spione, vertreibt aber Bürger und
          kostet Frömmigkeit. Milde Justiz gefällt den Kirchenfürsten und lockt Pilger an.
        </div>
      </GroupBox>

      <GroupBox label="Haushaltsplan (Vorschau)">
        <table className="kv">
          <tbody>
            <tr>
              <td>Einkommensteuer</td>
              <td className="num">
                <Money value={t.incomeTax} />
              </td>
            </tr>
            <tr>
              <td>Mehrwertsteuer</td>
              <td className="num">
                <Money value={t.salesTax} />
              </td>
            </tr>
            <tr>
              <td>Zölle</td>
              <td className="num">
                <Money value={t.tolls} />
              </td>
            </tr>
            {t.tradeBonus > 0 && (
              <tr className="muted">
                <td>&nbsp;&nbsp;davon Handelsabkommen</td>
                <td className="num">
                  <Money value={t.tradeBonus} signed />
                </td>
              </tr>
            )}
            {t.cityBonus > 0 && (
              <tr>
                <td>Stadt-Bonus</td>
                <td className="num">
                  <Money value={t.cityBonus} signed />
                </td>
              </tr>
            )}
            <tr>
              <td>Kriminalität</td>
              <td className="num">
                <Money value={-t.crimeLoss} signed />
              </td>
            </tr>
            <tr>
              <td>Sold (Garde &amp; Heer)</td>
              <td className="num">
                <Money value={-preview.militaryUpkeep} signed />
              </td>
            </tr>
            {preview.pilgrimIncome > 0 && (
              <tr>
                <td>Pilger &amp; Spenden</td>
                <td className="num">
                  <Money value={preview.pilgrimIncome} signed />
                </td>
              </tr>
            )}
            <tr>
              <td>Unterhalt Gebäude</td>
              <td className="num">
                <Money value={-preview.buildingUpkeep} signed />
              </td>
            </tr>
            <tr>
              <td>Kreditraten</td>
              <td className="num">
                <Money value={-preview.loanPayments} signed />
              </td>
            </tr>
            {preview.landlessKnightPay > 0 && (
              <tr>
                <td>Strafsold landloser Ritter</td>
                <td className="num">
                  <Money value={-preview.landlessKnightPay} signed />
                </td>
              </tr>
            )}
            <tr className="sum">
              <td>Saldo</td>
              <td className="num">
                <Money value={preview.netGold} signed />
              </td>
            </tr>
            <tr>
              <td>Kasse zum Jahresende</td>
              <td className="num">
                <b className={preview.goldAfter < 0 ? 'neg' : ''}>{n(preview.goldAfter)}</b>
              </td>
            </tr>
            <tr>
              <td className="muted">Sparzinsen (aufs Sparkonto)</td>
              <td className="num muted">+{n(preview.savingsInterest)}</td>
            </tr>
          </tbody>
        </table>
      </GroupBox>
    </div>
  );
}
