import { useState } from 'react';
import {
  actions,
  ELECTION_MAJORITY,
  nextTitleRequirements,
  piety,
  publicInfo,
  seatLabel,
  T,
  TITLES,
} from '../../engine';
import { GroupBox, n, NumberField, Progress, Tabs } from '../components/controls';
import { useGame } from '../context';
import { PixelIcon } from '../icons';

type Tab = 'title' | 'rivals' | 'reichstag';

export function ThroneWindow() {
  const { state } = useGame();
  const [tab, setTab] = useState<Tab>(state.election ? 'reichstag' : 'title');
  return (
    <div>
      <Tabs
        tabs={[
          { id: 'title', label: 'Adelsstand' },
          { id: 'rivals', label: 'Rivalen' },
          { id: 'reichstag', label: state.election ? 'Reichstag (Wahl!)' : 'Reichstag' },
        ]}
        active={tab}
        onChange={setTab}
      />
      <div className="tab-panel">
        {tab === 'title' && <TitleTab />}
        {tab === 'rivals' && <RivalsTab />}
        {tab === 'reichstag' && <ReichstagTab />}
      </div>
    </div>
  );
}

function TitleTab() {
  const { state, me } = useGame();
  const reqs = nextTitleRequirements(me);
  return (
    <div>
      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 8 }}>
        {TITLES.map((t, i) => (
          <span
            key={t}
            className={i === me.title ? 'raised' : 'sunken'}
            style={{ padding: '2px 5px', background: i === me.title ? '#000080' : i < me.title ? '#e0e0e0' : '#fff', color: i === me.title ? '#fff' : undefined, fontWeight: i === me.title ? 'bold' : undefined }}
          >
            {t}
          </span>
        ))}
      </div>
      <div>
        <b>{me.regentName}</b>, {TITLES[me.title]} – {me.name}. Frömmigkeit: {piety(me)} · Skandale: {me.scandals}
      </div>
      {reqs.length > 0 ? (
        <GroupBox label={`Voraussetzungen für ${TITLES[me.title + 1]} (alle gleichzeitig)`}>
          {reqs.map((r) => (
            <div key={r.key} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 130px', gap: 6, alignItems: 'center', marginBottom: 3 }}>
              <span>
                <span className={`w95-check ${r.met ? 'on' : ''}`} aria-label={r.met ? 'erfüllt' : 'offen'} /> {r.label}
              </span>
              <Progress value={r.progress} done={r.met} />
              <span style={{ textAlign: 'right' }} className={r.met ? 'pos' : ''}>
                {n(r.current)} / {n(r.required)}
              </span>
            </div>
          ))}
          <div className="hint">Pro Jahr ist höchstens eine Beförderung möglich. Schuldturm, Attentate und Verlust von mehr als der Hälfte Eures Landes führen zur Rückstufung.</div>
        </GroupBox>
      ) : me.title === T.KOENIG ? (
        <GroupBox label="Die Kaiserkrone">
          {me.buildings.cathedral > 0
            ? 'Ihr seid König und besitzt eine Kathedrale – der Reichstag wird einberufen bzw. ist einberufen.'
            : 'Baut eine Kathedrale, damit der Reichstag zur Kaiserwahl einberufen wird.'}
        </GroupBox>
      ) : (
        <GroupBox label="Kaiser">Ihr tragt die Kaiserkrone!</GroupBox>
      )}
      {me.casusBelli.length > 0 && (
        <div className="sunken field" style={{ padding: 6 }}>
          <PixelIcon name="barracks" /> Casus Belli gegen: <b>{me.casusBelli.map((id) => state.players.find((p) => p.id === id)?.name ?? id).join(', ')}</b> – Moralbonus und keine Marschkosten.
        </div>
      )}
    </div>
  );
}

function RivalsTab() {
  const { state, me } = useGame();
  const infos = state.players.map(publicInfo).sort((a, b) => b.score - a.score);
  return (
    <div>
      <div className="table-wrap sunken">
        <table className="grid">
          <thead>
            <tr>
              <th>Name</th>
              <th>Titel</th>
              <th className="num">Land ≈</th>
              <th className="num">Bürger ≈</th>
              <th className="num">Gebäude</th>
              <th className="num">Heer ≈</th>
              <th className="num">Punkte ≈</th>
            </tr>
          </thead>
          <tbody>
            {infos.map((p) => (
              <tr key={p.id} className={p.id === me.id ? 'selected' : ''}>
                <td>
                  <span style={{ color: p.id === me.id ? undefined : p.color, fontWeight: 'bold' }}>{p.name}</span> {p.isAI ? <span className="muted">(KI)</span> : ''}
                  {p.status && <span className="neg"> [{p.status}]</span>}
                </td>
                <td>{TITLES[p.title]}</td>
                <td className="num">{n(p.land)}</td>
                <td className="num">{n(p.population)}</td>
                <td className="num">
                  {p.buildings}
                  {p.cathedrals > 0 && (
                    <>
                      {' '}
                      <PixelIcon name="church" title="Kathedralen" />×{p.cathedrals}
                    </>
                  )}
                </td>
                <td className="num">{n(p.army)}</td>
                <td className="num">{n(p.score)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="hint">Öffentlich bekannte, gerundete Werte. Genaue Zahlen liefert nur ein Spion aus der Taverne.</div>
    </div>
  );
}

function ReichstagTab() {
  const { state, me, act, canAct } = useGame();
  const e = state.election;
  const [bribes, setBribes] = useState<Record<number, number>>({});
  const last = state.lastElection;

  if (!e) {
    return (
      <div>
        <p>Derzeit ist kein Reichstag einberufen. Sobald ein König eine Kathedrale besitzt, wird die Kaiserwahl ausgerufen.</p>
        <p className="hint">
          Das Kollegium hat 7 Stimmen: die Kurfürsten unter den Spielern und KI-Kirchenfürsten. Gewählt ist, wer {ELECTION_MAJORITY} Stimmen erhält. Kirchenfürsten urteilen nach
          Schmiergeld, Kathedralen und Frömmigkeit (milde Justiz) – Skandale schaden. Bei einem Patt verfällt alles eingesetzte Geld.
        </p>
        {last && <LastElection />}
      </div>
    );
  }

  const isCandidate = e.candidates.includes(me.id);
  const mySeat = e.seats.findIndex((s) => s.kind === 'player' && s.playerId === me.id);
  const myBribes = state.queue.filter((a) => a.kind === 'bribe' && a.from === me.id);
  const myVote = state.queue.find((a) => a.kind === 'vote' && a.from === me.id);

  return (
    <div>
      <p style={{ marginTop: 0 }}>
        <b>Kaiserwahl am Ende des Jahres {e.year}.</b> Kandidaten: {e.candidates.map((id) => state.players.find((p) => p.id === id)?.name).join(', ')}
      </p>
      <div className="table-wrap sunken">
        <table className="grid">
          <thead>
            <tr>
              <th>Sitz</th>
              <th>Wähler</th>
              {isCandidate && <th>Bestechung (verdeckt)</th>}
            </tr>
          </thead>
          <tbody>
            {e.seats.map((seat, i) => {
              const own = seat.kind === 'player' && seat.playerId === me.id;
              const placed = myBribes.reduce((sum, b) => sum + (b.kind === 'bribe' && b.seat === i ? b.gold : 0), 0);
              return (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>
                    <PixelIcon name={seat.kind === 'bishop' ? 'church' : 'throne'} />{' '}
                    {seatLabel(state, seat)}
                  </td>
                  {isCandidate && (
                    <td style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      {!own && (
                        <>
                          <NumberField value={bribes[i] ?? 0} onChange={(v) => setBribes((b) => ({ ...b, [i]: v }))} step={1000} width={80} label={`Bestechung Sitz ${i + 1}`} />
                          <button
                            className="btn small"
                            disabled={!canAct || !(bribes[i] > 0)}
                            onClick={() => act((s) => actions.placeBribe(s, me.id, i, bribes[i]))}
                          >
                            Zahlen
                          </button>
                          {placed > 0 && <span className="muted">({n(placed)} gezahlt)</span>}
                        </>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {isCandidate && (
        <div className="hint">
          Gold an Kirchenfürsten ist verloren – an Mitspieler wechselt es den Besitzer. Kirchenfürsten wiegen Kathedralen (+4.000 je Kathedrale), Frömmigkeit und Skandale gegen Euer Gold
          und enthalten sich, wenn sie nicht genug überzeugt sind. Bei einem Patt verfällt alles Geld.
        </div>
      )}
      {mySeat >= 0 && !isCandidate && (
        <GroupBox label="Eure Stimme als Kurfürst">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {e.candidates.map((id) => (
              <button key={id} className={`btn ${myVote?.kind === 'vote' && myVote.candidate === id ? 'pressed' : ''}`} disabled={!canAct} onClick={() => act((s) => actions.castVote(s, me.id, id))}>
                {state.players.find((p) => p.id === id)?.name}
              </button>
            ))}
          </div>
          <div className="hint">Ohne Stimmabgabe enthaltet Ihr Euch.</div>
        </GroupBox>
      )}
      {last && <LastElection />}
    </div>
  );
}

function LastElection() {
  const { state } = useGame();
  const last = state.lastElection!;
  return (
    <GroupBox label={`Letzte Wahl (${last.year})`}>
      {last.votes.map((v, i) => (
        <div key={i}>
          {v.seat}: <b>{v.candidate ? state.players.find((p) => p.id === v.candidate)?.name : 'Enthaltung'}</b>
        </div>
      ))}
    </GroupBox>
  );
}
