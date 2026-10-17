import { useState } from 'react';
import {
  actions,
  alliesOf,
  ALLIANCE_SHARE,
  hasPeace,
  TREATIES,
  treatiesBetween,
  armySize,
  attackPower,
  defensePower,
  entrenchCost,
  FIEF_HECTARES,
  fiefLand,
  fiefLandRequired,
  freeLand,
  KNIGHT_MIN_XP,
  landlessKnights,
  maneuverCost,
  marchCost,
  publicArmyEstimate,
  T,
  titleName,
  UNITS,
  type DismissableUnit,
  type RecruitableUnit,
} from '../../engine';
import { GroupBox, n, NumberField, Tabs } from '../components/controls';
import { useGame } from '../context';
import { PixelIcon } from '../icons';

type Tab = 'troops' | 'training' | 'campaign';
const RECRUITABLE: RecruitableUnit[] = ['guards', 'mercenaries', 'cannons', 'squires'];

export function BarracksWindow() {
  const [tab, setTab] = useState<Tab>('troops');
  return (
    <div>
      <Tabs
        tabs={[
          { id: 'troops', label: 'Truppen' },
          { id: 'training', label: 'Manöver & Lehnswesen' },
          { id: 'campaign', label: 'Feldzug' },
        ]}
        active={tab}
        onChange={setTab}
      />
      <div className="tab-panel">
        {tab === 'troops' && <Troops />}
        {tab === 'training' && <Training />}
        {tab === 'campaign' && <Campaign />}
      </div>
    </div>
  );
}

function Troops() {
  const { me, act, canAct } = useGame();
  const [counts, setCounts] = useState<Record<string, number>>({ guards: 10, mercenaries: 10, cannons: 1, squires: 5, knights: 1 });
  const units: DismissableUnit[] = [...RECRUITABLE, 'knights'];
  return (
    <div>
      <div className="table-wrap sunken">
        <table className="grid">
          <thead>
            <tr>
              <th>Einheit</th>
              <th className="num">Bestand</th>
              <th className="num">Handgeld</th>
              <th className="num">Sold/Jahr</th>
              <th>Anzahl</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {units.map((u) => {
              const def = UNITS[u];
              const locked = me.title < def.minTitle;
              return (
                <tr key={u}>
                  <td>
                    <b>{def.plural}</b>
                    {u === 'guards' && <div className="muted">Garde · bleibt daheim</div>}
                    {u === 'knights' && <div className="muted">nur per Ritterschlag</div>}
                    {locked && u !== 'knights' && <div className="muted">ab {titleName(def.minTitle, me.female)}</div>}
                  </td>
                  <td className="num">{n(me.military[u])}</td>
                  <td className="num">{u === 'knights' ? '–' : n(def.cost)}</td>
                  <td className="num">{u === 'knights' ? `0 (${FIEF_HECTARES} ha)` : n(def.upkeep)}</td>
                  <td>
                    <NumberField value={counts[u] ?? 0} onChange={(v) => setCounts((c) => ({ ...c, [u]: v }))} width={64} label={`Anzahl ${def.plural}`} />
                  </td>
                  <td style={{ display: 'flex', gap: 3 }}>
                    {u !== 'knights' && (
                      <button className="btn small" disabled={!canAct || locked} onClick={() => act((s) => actions.recruit(s, me.id, u as RecruitableUnit, counts[u] ?? 0))}>
                        Anwerben
                      </button>
                    )}
                    <button className="btn small" disabled={!canAct || me.military[u] === 0} onClick={() => act((s) => actions.dismiss(s, me.id, u, Math.min(counts[u] ?? 0, me.military[u])))}>
                      Entlassen
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="hint">
        <b>Garde</b> schützt vor Spionen, Dieben und Attentätern und zieht nie in den Krieg. Das <b>Heer</b> (Söldner, Kanonen, Knappen, Ritter) verteidigt die Grenzen und
        greift an. Gardisten und Knappen stammen aus Eurer Bevölkerung.
      </div>
      <div className="sunken field" style={{ padding: 6 }}>
        Verteidigungskraft daheim: <b>{n(defensePower(me))}</b> · Ausbildungsstand ×{me.military.training.toFixed(2)}
      </div>
    </div>
  );
}

function Training() {
  const { me, act, canAct } = useGame();
  const [knights, setKnights] = useState(1);
  const m = me.military;
  const landless = landlessKnights(me);
  return (
    <div>
      <GroupBox label="Manöver">
        <label className="check">
          <input type="checkbox" checked={me.maneuver} disabled={!canAct || armySize(m) === 0} onChange={(e) => act((s) => actions.setManeuver(s, me.id, e.target.checked))} />
          Dieses Jahr ein Manöver abhalten ({n(maneuverCost(me))} Taler)
        </label>
        <div className="hint">
          Hebt den Ausbildungsstand (derzeit ×{m.training.toFixed(2)}, max. ×1,50) und gibt Knappen eine Erfahrungsstufe. Ohne Manöver verfällt die Ausbildung langsam.
        </div>
      </GroupBox>

      <GroupBox label="Ritterschlag">
        <div>
          Knappen: <b>{n(m.squires)}</b> · Erfahrung: <b>{m.squireXp}</b> / {KNIGHT_MIN_XP} Manöver · Ritter: <b>{n(m.knights)}</b>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
          <NumberField value={knights} onChange={setKnights} width={64} label="Anzahl Ritter" />
          <button className="btn" disabled={!canAct || me.title < T.GRAF} onClick={() => act((s) => actions.knight(s, me.id, knights))}>
            Zum Ritter schlagen ({n(knights * UNITS.knights.cost)} Taler)
          </button>
        </div>
        <div className="hint">
          {me.title < T.GRAF ? 'Erst ab dem Titel Graf dürft Ihr Ritter schlagen. ' : ''}Ritter können nicht gekauft werden: Knappen anwerben, im Manöver ausbilden (Stufe {KNIGHT_MIN_XP}), dann gegen Gebühr zum
          Ritter schlagen. Ritter kosten keinen Sold, blockieren aber je {FIEF_HECTARES} ha Land als Lehen.
        </div>
      </GroupBox>

      <GroupBox label="Lehnswesen – Land gegen Sold">
        <table className="kv">
          <tbody>
            <tr>
              <td>Gesamtland</td>
              <td className="num">{n(me.land)} ha</td>
            </tr>
            <tr>
              <td>Lehnsland (Bedarf)</td>
              <td className="num">
                {n(fiefLand(me))} ({n(fiefLandRequired(me))}) ha
              </td>
            </tr>
            <tr>
              <td>Freies Ackerland</td>
              <td className="num">{n(freeLand(me))} ha</td>
            </tr>
          </tbody>
        </table>
        {landless > 0 && (
          <div className="neg" style={{ marginTop: 4 }}>
            <PixelIcon name="warning" /> {landless} Ritter sind landlos! Sie fordern 150 Taler Strafsold je Kopf – oder desertieren.
          </div>
        )}
      </GroupBox>
    </div>
  );
}

function Campaign() {
  const { state, me, act, canAct } = useGame();
  const rivals = state.players.filter((p) => p.id !== me.id);
  const [target, setTarget] = useState(rivals[0]?.id ?? '');
  const [fraction, setFraction] = useState(50);
  const t = state.players.find((p) => p.id === target);
  const myAttacks = state.queue.filter((a) => a.kind === 'attack' && a.from === me.id);
  const hasCb = t ? me.casusBelli.includes(t.id) : false;
  const breach = t ? hasPeace(state, me.id, t.id) : false;
  // Bündnisse sind öffentlich – deren Hilfstruppen lassen sich grob abschätzen.
  const allies = t ? alliesOf(state, t.id).filter((id) => id !== me.id).map((id) => state.players.find((p) => p.id === id)!) : [];
  const allyHelp = allies.reduce((sum, a) => sum + (a.debtorPrison > 0 ? 0 : publicArmyEstimate(a) * ALLIANCE_SHARE), 0);

  return (
    <div>
      <GroupBox label="Neuer Feldzug">
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          Ziel:
          <select className="input" value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Angriffsziel">
            {rivals.map((r) => (
              <option key={r.id} value={r.id}>
                {titleName(r.title, r.female)} {r.name}
                {me.casusBelli.includes(r.id) ? ' – Casus Belli!' : ''}
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 40px', gap: 6, alignItems: 'center', marginTop: 6 }}>
          <span>Ausrückendes Heer</span>
          <input type="range" min={10} max={100} step={10} value={fraction} onChange={(e) => setFraction(Number(e.target.value))} aria-label="Anteil des Heeres" />
          <b>{fraction} %</b>
        </div>
        {t && (
          <div className="preview-box sunken">
            <table className="kv">
              <tbody>
                <tr>
                  <td>Eure Angriffskraft</td>
                  <td className="num">{n(attackPower(me, fraction / 100, t.id))}</td>
                </tr>
                <tr>
                  <td>Geschätzte Verteidigung von {t.name}</td>
                  <td className="num">~{n(publicArmyEstimate(t))}</td>
                </tr>
                {allies.length > 0 && (
                  <tr>
                    <td>Bündnistruppen ({allies.map((a) => a.name).join(', ')})</td>
                    <td className="num">~{n(allyHelp)}</td>
                  </tr>
                )}
                <tr>
                  <td>Marschkosten</td>
                  <td className="num">{hasCb ? 'keine (Casus Belli)' : `${n(marchCost(me, fraction / 100, t.id))} Taler`}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
        {breach && t && (
          <div className="sunken field" style={{ padding: 6 }}>
            <PixelIcon name="warning" /> <b>Vertragsbruch!</b> Mit {t.name} besteht {treatiesBetween(state, me.id, t.id).filter((x) => x.type !== 'trade').map((x) => `${TREATIES[x.type].einen} ${TREATIES[x.type].name}`).join(' und ')}. Ein Angriff
            bricht ihn: alle Verträge mit {t.name} enden, Ihr erhaltet einen Skandal, {t.name} einen Casus Belli gegen Euch, und alle anderen Herrscher tragen es Euch nach.
          </div>
        )}
        <div className="hint">
          Kampfkraft = Basiskraft × Moral × Ausbildung × Defensivbonus (Paläste, Eingraben). Der Verlierer büßt 10–25 % seines Landes und Bargeldes ein – auch der Angreifer! Die Schlacht
          wird erst beim Jahreswechsel geschlagen. Die zurückbleibenden Truppen verteidigen Euer Land. Verbündete des Verteidigers schicken {ALLIANCE_SHARE * 100} % ihres Heeres.
        </div>
        <div className="btn-row">
          <button className="btn primary" disabled={!canAct || !t} onClick={() => act((s) => actions.queueAttack(s, me.id, target, fraction / 100))}>
            Marschbefehl erteilen
          </button>
        </div>
      </GroupBox>

      {myAttacks.length > 0 && (
        <GroupBox label="Marschbefehle">
          {myAttacks.map((a) =>
            a.kind === 'attack' ? (
              <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 2 }}>
                <span>
                  {Math.round(a.fraction * 100)} % des Heeres gegen {state.players.find((p) => p.id === a.target)?.name}
                </span>
                <button className="btn small" disabled={!canAct} onClick={() => act((s) => actions.cancelAction(s, me.id, a.id))}>
                  Abblasen
                </button>
              </div>
            ) : null,
          )}
        </GroupBox>
      )}

      <GroupBox label="Verteidigung">
        <label className="check">
          <input type="checkbox" checked={me.entrenched} disabled={!canAct} onChange={(e) => act((s) => actions.setEntrenched(s, me.id, e.target.checked))} />
          Eingraben: +25 % Verteidigung für dieses Jahr ({n(entrenchCost(me))} Taler)
        </label>
        <div className="hint">Jeder Palast bringt +10 % Verteidigung (max. +50 %). Im Schuldturm ist Euer Heer führerlos und wehrlos.</div>
      </GroupBox>
    </div>
  );
}
