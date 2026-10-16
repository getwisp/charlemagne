import { actions, previewEconomy, grainBuyCost, granaryProtection, grainNeed, RAT_MAX, RAT_MIN } from '../../engine';
import { GroupBox, n } from '../components/controls';
import { useGame } from '../context';
import { PixelIcon } from '../icons';

export function GranaryWindow() {
  const { state, me, act, canAct } = useGame();
  const need = grainNeed(me);
  const preview = previewEconomy(state, me);
  const affordable = need > 0 ? Math.floor((me.grain / need) * 100) : 100;
  const protection = granaryProtection(me.buildings);
  const set = (v: number) => act((s) => actions.setRation(s, me.id, v));
  // Die Ration ist ein Anteil des Bedarfs: Mehr Korn im Lager ändert die Ausgabe erst, wenn es vorher knapp war.
  const wanted = Math.ceil((need * me.ration) / 100);
  const missing = Math.max(0, wanted - me.grain);
  const missingCost = grainBuyCost(state, missing);

  return (
    <div>
      <table className="kv">
        <tbody>
          <tr>
            <td>Kornvorrat</td>
            <td className="num">
              <b>{n(me.grain)}</b> Scheffel
            </td>
          </tr>
          <tr>
            <td>davon Ernte {state.year}</td>
            <td className="num">{n(me.harvestThisYear)} Scheffel</td>
          </tr>
          <tr>
            <td>Bedarf (2 Scheffel je Bürger)</td>
            <td className="num">{n(need)} Scheffel</td>
          </tr>
          <tr>
            <td>Vorrat reicht für</td>
            <td className={`num ${affordable < 100 ? 'neg' : ''}`}>{affordable} % des Bedarfs</td>
          </tr>
        </tbody>
      </table>

      <GroupBox label={`Kornausgabe: ${me.ration} %`}>
        <input
          type="range"
          min={0}
          max={200}
          step={5}
          value={me.ration}
          disabled={!canAct}
          onChange={(e) => set(Number(e.target.value))}
          aria-label="Kornausgabe in Prozent"
        />
        <div className="btn-row" style={{ justifyContent: 'space-between', marginTop: 4 }}>
          {[50, 80, 100, 120, 150].map((v) => (
            <button key={v} className={`btn small ${me.ration === v ? 'pressed' : ''}`} disabled={!canAct} onClick={() => set(v)}>
              {v} %
            </button>
          ))}
        </div>
        <div className="hint">
          100 % ernährt alle Bürger. Darunter drohen Hungersnot und Abwanderung, darüber zieht es Zuwanderer in Eure Lande.
        </div>
        {missing > 0 ? (
          <div className="sunken" style={{ background: '#ffffe1', padding: 6, marginTop: 4 }}>
            <PixelIcon name="warning" /> Für {me.ration} % fehlen <b>{n(missing)} Scheffel</b> – ausgegeben werden nur {n(preview.grainDistributed)}.
            <div className="btn-row" style={{ marginTop: 4 }}>
              <button
                className="btn small"
                disabled={!canAct || me.gold < missingCost}
                onClick={() => act((s) => actions.buyGrain(s, me.id, missing))}
              >
                Fehlendes Korn kaufen ({n(missingCost)} Taler)
              </button>
            </div>
          </div>
        ) : (
          <div className="hint pos">
            ✓ Der Vorrat deckt die Ration ({n(wanted)} Scheffel). Zusätzlich gekauftes Korn bleibt im Lager – und lockt Ratten an.
          </div>
        )}
      </GroupBox>

      <GroupBox label="Vorschau zum Jahresende">
        <div className="preview-box sunken">
          <table className="kv">
            <tbody>
              <tr>
                <td>Ausgegeben (Ration {me.ration} %)</td>
                <td className="num">{n(preview.grainDistributed)} Scheffel</td>
              </tr>
              <tr>
                <td>Geburten / natürliche Tode</td>
                <td className="num">
                  <span className="pos">+{n(preview.births)}</span> / <span className="neg">−{n(preview.deaths)}</span>
                </td>
              </tr>
              {preview.starved > 0 && (
                <tr>
                  <td>Verhungert</td>
                  <td className="num neg">−{n(preview.starved)}</td>
                </tr>
              )}
              <tr>
                <td>Zuwanderer / Abwanderer</td>
                <td className="num">
                  <span className="pos">+{n(preview.immigrants)}</span> / <span className="neg">−{n(preview.emigrants)}</span>
                </td>
              </tr>
              <tr className="sum">
                <td>Bevölkerung im nächsten Jahr</td>
                <td className="num">{n(preview.populationAfter)}</td>
              </tr>
              <tr>
                <td>Rattenfraß (erwartet)</td>
                <td className="num neg">−{n(preview.ratLoss)}</td>
              </tr>
              <tr className="sum">
                <td>Restvorrat</td>
                <td className="num">{n(preview.grainAfter)} Scheffel</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="hint">
          Ratten fressen jährlich {RAT_MIN * 100}–{RAT_MAX * 100} % des Lagers. Eure {me.buildings.granary} Kornspeicher schützen {Math.round(protection * 100)} %.
        </div>
      </GroupBox>
    </div>
  );
}
