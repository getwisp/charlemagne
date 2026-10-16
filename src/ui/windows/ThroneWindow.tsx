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
  TREATIES,
  TREATY_YEARS,
  SCANDAL_DECAY_YEARS,
  ALLIANCE_SHARE,
  TRADE_TREATY_BONUS,
  TRADE_TREATY_MAX,
  offerBlocker,
  treatiesBetween,
  yearsLeft,
  type TreatyType,
} from '../../engine';
import { GroupBox, n, NumberField, Progress, Tabs } from '../components/controls';
import { useGame } from '../context';
import { PixelIcon } from '../icons';

type Tab = 'title' | 'rivals' | 'diplomacy' | 'reichstag';

export function ThroneWindow() {
  const { state } = useGame();
  const { me } = useGame();
  const incoming = (state.offers ?? []).filter((o) => o.to === me.id).length;
  const [tab, setTab] = useState<Tab>(state.election ? 'reichstag' : incoming > 0 ? 'diplomacy' : 'title');
  return (
    <div>
      <Tabs
        tabs={[
          { id: 'title', label: 'Adelsstand' },
          { id: 'rivals', label: 'Rivalen' },
          { id: 'diplomacy', label: incoming > 0 ? `Diplomatie (${incoming})` : 'Diplomatie' },
          { id: 'reichstag', label: state.election ? 'Reichstag (Wahl!)' : 'Reichstag' },
        ]}
        active={tab}
        onChange={setTab}
      />
      <div className="tab-panel">
        {tab === 'title' && <TitleTab />}
        {tab === 'rivals' && <RivalsTab />}
        {tab === 'diplomacy' && <DiplomacyTab />}
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
        {me.scandals > 0 && <span className="muted"> (nächster verjährt in {SCANDAL_DECAY_YEARS - (me.scandalClock ?? 0)} Jahren)</span>}
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
              <th>Verträge</th>
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
                <td>{p.id === me.id ? '' : <TreatyBadges partner={p.id} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="hint">Öffentlich bekannte, gerundete Werte. Genaue Zahlen liefert nur ein Spion aus der Taverne.</div>
    </div>
  );
}

/** Kurzanzeige der Verträge mit einem Partner, jeweils mit Restlaufzeit. */
function TreatyBadges({ partner }: { partner: string }) {
  const { state, me } = useGame();
  const list = treatiesBetween(state, me.id, partner);
  if (list.length === 0) return <span className="muted">–</span>;
  return (
    <>
      {list.map((t) => (
        <span key={t.id} className="sunken" style={{ padding: '0 4px', marginRight: 3, background: '#fff' }} title={`${TREATIES[t.type].name}: noch ${yearsLeft(t, state.year)} Jahre (bis ${t.until})`}>
          {TREATIES[t.type].short} {yearsLeft(t, state.year)}J
        </span>
      ))}
    </>
  );
}

const TREATY_TYPES: TreatyType[] = ['nap', 'trade', 'alliance'];

function DiplomacyTab() {
  const { state, me, act, canAct } = useGame();
  const rivals = state.players.filter((p) => p.id !== me.id);
  const [to, setTo] = useState(rivals[0]?.id ?? '');
  const [type, setType] = useState<TreatyType>('nap');
  const [gold, setGold] = useState(0);
  const name = (id: string) => state.players.find((p) => p.id === id)?.name ?? id;
  const incoming = (state.offers ?? []).filter((o) => o.to === me.id);
  const outgoing = [
    ...state.queue.filter((a) => a.kind === 'offer' && a.from === me.id).map((a) => (a.kind === 'offer' ? { id: a.id, to: a.to, type: a.treatyType, gold: a.gold, queued: true } : null)),
    ...(state.offers ?? []).filter((o) => o.from === me.id).map((o) => ({ id: o.id, to: o.to, type: o.type, gold: o.gold, queued: false })),
  ].filter((x): x is { id: string; to: string; type: TreatyType; gold: number; queued: boolean } => x !== null);
  const blocker = to ? offerBlocker(state, me.id, to, type) : 'Kein Empfänger.';

  return (
    <div>
      <GroupBox label="Verträge">
        <div className="table-wrap sunken">
          <table className="grid">
            <thead>
              <tr>
                <th>Herrscher</th>
                <th>Bestehende Verträge</th>
              </tr>
            </thead>
            <tbody>
              {rivals.map((r) => (
                <tr key={r.id}>
                  <td>
                    <span style={{ color: r.color, fontWeight: 'bold' }}>{r.name}</span> <span className="muted">{TITLES[r.title]}</span>
                  </td>
                  <td>
                    {treatiesBetween(state, me.id, r.id).length === 0 ? (
                      <span className="muted">keine</span>
                    ) : (
                      treatiesBetween(state, me.id, r.id).map((t) => (
                        <div key={t.id}>
                          {TREATIES[t.type].name} – noch <b>{yearsLeft(t, state.year)}</b> {yearsLeft(t, state.year) === 1 ? 'Jahr' : 'Jahre'} (bis {t.until})
                        </div>
                      ))
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="hint">
          Verträge laufen fest {TREATY_YEARS} Jahre und lassen sich nicht kündigen. Wer einen Partner mit Nichtangriffspakt oder Bündnis angreift, bricht sein Wort: Skandal, Casus Belli für das Opfer und Groll aller Herrscher. Fliegt ein Dieb, Saboteur oder Attentäter
          beim Partner auf, platzen die Verträge (Spionage allein nicht).
        </div>
      </GroupBox>

      {incoming.length > 0 && (
        <GroupBox label="Gesandte warten auf Antwort">
          {incoming.map((o) => (
            <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, padding: 2, flexWrap: 'wrap' }}>
              <span>
                <PixelIcon name="scroll" /> <b>{name(o.from)}</b> bietet {TREATIES[o.type].einen} {TREATIES[o.type].name}
                {o.gold > 0 && <> mit {n(o.gold)} Talern Mitgift</>} (verfällt zum Jahresende)
              </span>
              <span className="btn-row" style={{ margin: 0 }}>
                <button className="btn small" disabled={!canAct} onClick={() => act((s) => actions.acceptOffer(s, me.id, o.id))}>
                  Annehmen
                </button>
                <button className="btn small" disabled={!canAct} onClick={() => act((s) => actions.declineOffer(s, me.id, o.id))}>
                  Ablehnen
                </button>
              </span>
            </div>
          ))}
        </GroupBox>
      )}

      <GroupBox label="Gesandten entsenden">
        {TREATY_TYPES.map((t) => (
          <label key={t} className="check" style={{ display: 'flex', marginBottom: 3 }}>
            <input type="radio" name="treaty" checked={type === t} onChange={() => setType(t)} />
            <b>{TREATIES[t].name}</b>
            <span className="muted">
              – {t === 'trade' ? `Beide erhalten +${TRADE_TREATY_BONUS * 100} % Handelsvolumen (Mehrwertsteuer und Zölle), höchstens ${TRADE_TREATY_MAX} Abkommen zählen.` : t === 'alliance' ? `Enthält einen Nichtangriffspakt. Wird ein Partner angegriffen, kämpfen ${ALLIANCE_SHARE * 100} % des Heeres des anderen mit – und tragen dieselben Verluste.` : TREATIES[t].description}
            </span>
          </label>
        ))}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginTop: 6 }}>
          An:
          <select className="input" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Empfänger">
            {rivals.map((r) => (
              <option key={r.id} value={r.id}>
                {TITLES[r.title]} {r.name}
              </option>
            ))}
          </select>
          Mitgift: <NumberField value={gold} onChange={setGold} min={0} step={250} label="Mitgift" /> Taler
        </div>
        <div className="hint">Der Gesandte reist zum Jahreswechsel. Der Empfänger antwortet im folgenden Jahr; lehnt er ab oder schweigt, kehrt die Mitgift zurück.</div>
        <div className="btn-row">
          <button className="btn primary" disabled={!canAct || !!blocker || gold > me.gold} title={blocker ?? undefined} onClick={() => act((s) => actions.offerTreaty(s, me.id, to, type, gold))}>
            Gesandten entsenden
          </button>
        </div>
        {blocker && to && <div className="hint">{blocker}</div>}
      </GroupBox>

      {outgoing.length > 0 && (
        <GroupBox label="Eigene Angebote">
          {outgoing.map((o) => (
            <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 2 }}>
              <span>
                {TREATIES[o.type].name} an {name(o.to)}
                {o.gold > 0 && <> ({n(o.gold)} Taler)</>} – {o.queued ? 'Gesandter reist zum Jahreswechsel' : 'wartet auf Antwort'}
              </span>
              {o.queued && (
                <button className="btn small" disabled={!canAct} onClick={() => act((s) => actions.cancelAction(s, me.id, o.id))}>
                  Zurückziehen
                </button>
              )}
            </div>
          ))}
        </GroupBox>
      )}
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
