import { useState } from 'react';
import { actions, COVERT, COVERT_MIN_GOLD, covertChance, titleName, type CovertMission, type SabotageTarget } from '../../engine';
import { GroupBox, n, NumberField } from '../components/controls';
import { useGame } from '../context';
import { PixelIcon } from '../icons';

const MISSIONS: CovertMission[] = ['spy', 'rob', 'sabotage', 'assassinate'];
const SABOTAGE: Record<SabotageTarget, string> = { mill: 'Mühle', market: 'Markt', grain: 'Kornspeicher' };

function innkeeperGuess(p: number): string {
  if (p < 0.1) return 'aussichtslos';
  if (p < 0.25) return 'gering';
  if (p < 0.45) return 'mäßig';
  if (p < 0.65) return 'ordentlich';
  return 'gut';
}

export function TavernWindow() {
  const { state, me, act, canAct } = useGame();
  const rivals = state.players.filter((p) => p.id !== me.id);
  const [mission, setMission] = useState<CovertMission>('spy');
  const [target, setTarget] = useState(rivals[0]?.id ?? '');
  const [gold, setGold] = useState(1000);
  const [sabotage, setSabotage] = useState<SabotageTarget>('mill');
  const t = state.players.find((p) => p.id === target);
  const mine = state.queue.filter((a) => a.kind === 'covert' && a.from === me.id);
  const def = COVERT[mission];
  const locked = me.title < def.minTitle;
  // Der Wirt schätzt nur grob – genaue Gardestärken kennt er nicht.
  const guess = t ? innkeeperGuess(covertChance(gold, t, mission)) : '';

  return (
    <div>
      <div className="sunken field" style={{ padding: 6 }}>
        <PixelIcon name="tavern" /> Der Wirt beugt sich vor: „Für den rechten Preis findet sich für jede Arbeit ein Mann…“ Aufträge werden verdeckt zum Jahreswechsel ausgeführt.
      </div>

      <GroupBox label="Auftrag">
        {MISSIONS.map((m) => (
          <label key={m} className="check" style={{ display: 'flex', marginBottom: 3 }}>
            <input type="radio" name="mission" checked={mission === m} onChange={() => setMission(m)} />
            <b>{COVERT[m].name}</b>
            <span className="muted">
              (ab {titleName(COVERT[m].minTitle, me.female)}) – {COVERT[m].description}
            </span>
          </label>
        ))}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginTop: 6 }}>
          Ziel:
          <select className="input" value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Ziel">
            {rivals.map((r) => (
              <option key={r.id} value={r.id}>
                {titleName(r.title, r.female)} {r.name}
              </option>
            ))}
          </select>
          {mission === 'sabotage' && (
            <select className="input" value={sabotage} onChange={(e) => setSabotage(e.target.value as SabotageTarget)} aria-label="Sabotageziel">
              {(Object.keys(SABOTAGE) as SabotageTarget[]).map((k) => (
                <option key={k} value={k}>
                  {SABOTAGE[k]}
                </option>
              ))}
            </select>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
          Schmiergeld: <NumberField value={gold} onChange={setGold} min={0} step={250} label="Schmiergeld" /> Taler
          <span>
            Einschätzung des Wirts: <b>{guess}</b>
          </span>
        </div>
        <div className="hint">
          Erfolgschance = Gold ÷ (Gold + Garde × Justizhärte des Opfers). Raub fängt zusätzlich einen Teil der Steuereinnahmen des Opfers ab. Attentate gelingen höchstens zu 25 %. Scheitert ein Agent und redet unter der Folter, erhält das Opfer einen
          Casus Belli gegen Euch. Das Gold ist in jedem Fall weg. Mindesteinsatz {COVERT_MIN_GOLD} Taler.
        </div>
        <div className="btn-row">
          <button
            className="btn primary"
            disabled={!canAct || locked || !t}
            onClick={() => act((s) => actions.queueCovert(s, me.id, target, mission, gold, mission === 'sabotage' ? sabotage : undefined))}
          >
            {locked ? `Erst ab ${titleName(def.minTitle, me.female)}` : 'Auftrag erteilen'}
          </button>
        </div>
      </GroupBox>

      {mine.length > 0 && (
        <GroupBox label="Laufende Aufträge">
          {mine.map((a) =>
            a.kind === 'covert' ? (
              <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 2 }}>
                <span>
                  {COVERT[a.mission].name} gegen {state.players.find((p) => p.id === a.target)?.name} ({n(a.gold)} Taler)
                </span>
                <button className="btn small" disabled={!canAct} onClick={() => act((s) => actions.cancelAction(s, me.id, a.id))}>
                  Zurückziehen
                </button>
              </div>
            ) : null,
          )}
        </GroupBox>
      )}
    </div>
  );
}
