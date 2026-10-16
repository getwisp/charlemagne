import { useEffect, useMemo, useState, type ComponentType } from 'react';
import {
  actions,
  calculateEconomyTurn,
  cityCount,
  fiefLand,
  freeLand,
  builtLand,
  grainNeed,
  TITLES,
  type GameState,
  type HeraldMessage,
} from '../engine';
import { BossScreen } from './BossScreen';
import { n } from './components/controls';
import { Alert, Modal, Window } from './components/Window';
import { useGame } from './context';
import { downloadSave, pickSaveFile } from './storage';
import { BankWindow } from './windows/BankWindow';
import { BarracksWindow } from './windows/BarracksWindow';
import { BuildWindow } from './windows/BuildWindow';
import { ChronicleWindow } from './windows/ChronicleWindow';
import { GranaryWindow } from './windows/GranaryWindow';
import { HelpWindow } from './windows/HelpWindow';
import { HeraldWindow } from './windows/HeraldWindow';
import { MarketWindow } from './windows/MarketWindow';
import { StatsWindow } from './windows/StatsWindow';
import { TavernWindow } from './windows/TavernWindow';
import { ThroneWindow } from './windows/ThroneWindow';
import { TreasuryWindow } from './windows/TreasuryWindow';

export type WinId =
  | 'granary'
  | 'market'
  | 'build'
  | 'treasury'
  | 'bank'
  | 'barracks'
  | 'tavern'
  | 'throne'
  | 'stats'
  | 'chronicle'
  | 'herald'
  | 'help';

interface WinDef {
  title: string;
  icon: string;
  width: number;
  component: ComponentType<{ read: HeraldMessage[] }>;
  desktop: boolean;
}

const WINDOWS: Record<WinId, WinDef> = {
  granary: { title: 'Kornkammer', icon: '🌾', width: 430, component: GranaryWindow, desktop: true },
  market: { title: 'Marktplatz', icon: '⚖️', width: 430, component: MarketWindow, desktop: true },
  build: { title: 'Bauamt', icon: '🏗️', width: 560, component: BuildWindow, desktop: true },
  treasury: { title: 'Schatzamt', icon: '💰', width: 480, component: TreasuryWindow, desktop: true },
  bank: { title: 'Bankhaus Fugger', icon: '🏦', width: 520, component: BankWindow, desktop: true },
  barracks: { title: 'Kaserne', icon: '⚔️', width: 560, component: BarracksWindow, desktop: true },
  tavern: { title: 'Taverne „Zum goldenen Dolch“', icon: '🍺', width: 520, component: TavernWindow, desktop: true },
  throne: { title: 'Thronsaal', icon: '👑', width: 600, component: ThroneWindow, desktop: true },
  stats: { title: 'Statistik', icon: '📈', width: 520, component: StatsWindow, desktop: true },
  chronicle: { title: 'Reichschronik', icon: '📖', width: 460, component: ChronicleWindow, desktop: true },
  herald: { title: 'Herold', icon: '📯', width: 460, component: HeraldWindow, desktop: true },
  help: { title: 'Hilfe', icon: '❓', width: 560, component: HelpWindow, desktop: true },
};

interface OpenWin {
  id: WinId;
  x: number;
  y: number;
  z: number;
  minimized: boolean;
}

interface DesktopProps {
  onEndTurn: (s: GameState) => void;
  onReset: () => void;
  onLoad: (s: GameState) => void;
  onQuit: () => void;
  setRaw: (s: GameState) => void;
}

export function Desktop({ onEndTurn, onReset, onLoad, onQuit, setRaw }: DesktopProps) {
  const { state, me, canAct } = useGame();
  const [open, setOpen] = useState<OpenWin[]>([]);
  const [zTop, setZTop] = useState(10);
  const [startOpen, setStartOpen] = useState(false);
  const [boss, setBoss] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [readThisTurn, setReadThisTurn] = useState<HeraldMessage[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const unread = state.messages[me.id] ?? [];
  const preview = useMemo(() => calculateEconomyTurn(me, state.market), [me, state.market]);

  // Neuer Spieler/neues Jahr → Fenster zurücksetzen, gelesene Meldungen leeren
  useEffect(() => {
    setOpen([]);
    setReadThisTurn([]);
  }, [me.id, state.year]);

  // Boss-Taste: F2 (oder Esc zum Zurückkehren)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        setBoss((b) => !b);
      } else if (e.key === 'Escape') {
        setBoss(false);
        setStartOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function openWindow(id: WinId) {
    setStartOpen(false);
    const z = zTop + 1;
    setZTop(z);
    setOpen((ws) => {
      const existing = ws.find((w) => w.id === id);
      if (existing) return ws.map((w) => (w.id === id ? { ...w, z, minimized: false } : w));
      const narrow = window.innerWidth < 700;
      if (narrow) return [...ws, { id, x: 2, y: 2, z, minimized: false }];
      // Neben die offenen Fenster stellen, damit nichts verdeckt wird; erst wenn kein Platz ist, kaskadieren.
      const deskWidth = document.querySelector('.desktop')?.clientWidth ?? window.innerWidth - 220;
      const visible = ws.filter((w) => !w.minimized);
      const right = Math.max(100, ...visible.map((w) => w.x + WINDOWS[w.id].width + 8));
      if (right + WINDOWS[id].width <= deskWidth) return [...ws, { id, x: right, y: 10, z, minimized: false }];
      const offset = (ws.length % 6) * 24;
      return [...ws, { id, x: 100 + offset, y: 10 + offset, z, minimized: false }];
    });
  }
  const focus = (id: WinId) => {
    const top = open.reduce((m, w) => Math.max(m, w.z), 0);
    if (open.find((w) => w.id === id)?.z === top) return;
    const z = zTop + 1;
    setZTop(z);
    setOpen((ws) => ws.map((w) => (w.id === id ? { ...w, z } : w)));
  };
  const close = (id: WinId) => setOpen((ws) => ws.filter((w) => w.id !== id));
  const minimize = (id: WinId) => setOpen((ws) => ws.map((w) => (w.id === id ? { ...w, minimized: true } : w)));
  const move = (id: WinId, x: number, y: number) => setOpen((ws) => ws.map((w) => (w.id === id ? { ...w, x, y } : w)));
  const activeId = open.filter((w) => !w.minimized).sort((a, b) => b.z - a.z)[0]?.id;

  function markRead(all: boolean) {
    const [first, ...rest] = unread;
    if (!first) return;
    setReadThisTurn((r) => [...r, ...(all ? unread : [first])]);
    setRaw({ ...state, messages: { ...state.messages, [me.id]: all ? [] : rest } });
  }

  function endTurn() {
    setConfirmEnd(false);
    onEndTurn(actions.endTurn(state, me.id));
  }

  async function load() {
    setStartOpen(false);
    try {
      onLoad(await pickSaveFile());
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    }
  }

  const warnings: string[] = [];
  if (me.ration < 100) warnings.push(`Die Kornausgabe liegt bei nur ${me.ration} % – es droht Hunger.`);
  if (preview.grainDistributed < (grainNeed(me) * me.ration) / 100 - 1) warnings.push('Euer Kornvorrat reicht nicht für die gewählte Ration.');
  if (preview.goldAfter < 0) warnings.push(`Die Kasse wird ins Minus rutschen (${n(preview.goldAfter)} Taler) – Pfändung droht!`);
  if (preview.landlessKnights > 0) warnings.push(`${preview.landlessKnights} Ritter sind ohne Lehen und fordern Strafsold.`);

  const blocked = me.debtorPrison > 0 ? 'Schuldturm' : me.sickbed > 0 ? 'Krankenbett' : null;
  const myQueue = state.queue.filter((a) => a.from === me.id);

  return (
    <div className="app" onPointerDown={() => startOpen && setStartOpen(false)}>
      {/* ------------------------------------------------------- Statusleiste */}
      <aside className="sidebar raised" aria-label="Statusleiste">
        <div className="sb-head" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Anno {state.year}</span>
          <span>{state.market.weather}</span>
        </div>
        <div className="sb-body">
          <div style={{ fontWeight: 'bold', color: me.color, fontSize: 13 }}>{me.name}</div>
          <div className="muted" style={{ marginTop: -3 }}>
            {TITLES[me.title]} · Regent: {me.regentName}
          </div>
          {blocked && (
            <div className="sunken" style={{ background: '#ffffe1', padding: 4 }}>
              ⛓️ Ihr seid im <b>{blocked}</b> und könnt dieses Jahr nichts befehlen.
            </div>
          )}
          <Stat label="💰 Gold" value={`${n(me.gold)}`} neg={me.gold < 0} />
          <Stat label="🏦 Sparkonto" value={n(me.savings)} />
          <Stat label="🌾 Korn" value={`${n(me.grain)} Sch.`} />
          <Stat label="🗺️ Land" value={`${n(me.land)} ha`} />
          <div className="hint" style={{ margin: '0 4px' }}>
            bebaut {n(builtLand(me))} · Lehen {n(fiefLand(me))} · frei {n(freeLand(me))}
          </div>
          <Stat label="👥 Bürger" value={n(me.population)} />
          <Stat label="🏘️ Städte" value={`${cityCount(me.buildings)}`} />
          <Stat label="🛡️ Garde / Heer" value={`${n(me.military.guards)} / ${n(me.military.mercenaries + me.military.cannons + me.military.squires + me.military.knights)}`} />
          <hr className="etched" />
          <Stat label="Kornpreis" value={`${state.market.grainPrice} T/10 Sch.`} />
          <Stat label="Landpreis" value={`${state.market.landPrice} T/ha`} />
          <Stat label="Leitzins" value={`${state.market.baseRate} %`} />
          <hr className="etched" />
          <div className="sunken field" style={{ padding: 4 }}>
            <div className="muted">Vorschau Jahresende:</div>
            <div>
              Kasse: <b className={preview.goldAfter < 0 ? 'neg' : ''}>{n(preview.goldAfter)}</b> ({preview.netGold >= 0 ? '+' : ''}
              {n(preview.netGold)})
            </div>
            <div>
              Bürger: <b>{n(preview.populationAfter)}</b> ({preview.populationAfter - me.population >= 0 ? '+' : ''}
              {n(preview.populationAfter - me.population)})
            </div>
            {myQueue.length > 0 && <div>Befehle in Warteschlange: {myQueue.length}</div>}
          </div>
          {state.election && (
            <button className="btn" onClick={() => openWindow('throne')}>
              🗳️ Reichstag {state.election.year}!
            </button>
          )}
          <button className="btn primary" style={{ marginTop: 6, minHeight: 30, fontWeight: 'bold' }} onClick={() => (blocked ? endTurn() : setConfirmEnd(true))}>
            {blocked ? 'Jahr aussetzen ▶' : 'Zug beenden ▶'}
          </button>
          {canAct && (
            <button className="btn small" onClick={() => setConfirmReset(true)}>
              Zug zurücksetzen
            </button>
          )}
        </div>
      </aside>

      {/* ------------------------------------------------------- Desktop */}
      <main className="desktop" aria-label="Desktop">
        <div className="icons">
          {(Object.keys(WINDOWS) as WinId[])
            .filter((id) => WINDOWS[id].desktop)
            .map((id) => (
              <button key={id} className={`icon ${activeId === id ? 'selected' : ''}`} onClick={() => openWindow(id)}>
                <span className="glyph" aria-hidden>
                  {WINDOWS[id].icon}
                </span>
                <span className="caption">{WINDOWS[id].title.replace(/ „.*“/, '')}</span>
              </button>
            ))}
        </div>
        {open
          .filter((w) => !w.minimized)
          .map((w) => {
            const def = WINDOWS[w.id];
            const C = def.component;
            return (
              <Window
                key={w.id}
                title={def.title}
                icon={def.icon}
                x={w.x}
                y={w.y}
                z={w.z}
                width={def.width}
                active={activeId === w.id}
                onFocus={() => focus(w.id)}
                onClose={() => close(w.id)}
                onMinimize={() => minimize(w.id)}
                onMove={(x, y) => move(w.id, x, y)}
              >
                <C read={readThisTurn} />
              </Window>
            );
          })}
      </main>

      {/* ------------------------------------------------------- Taskleiste */}
      <footer className="taskbar">
        <button
          className={`btn start ${startOpen ? 'pressed' : ''}`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setStartOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={startOpen}
        >
          <span aria-hidden>🏰</span> Start
        </button>
        <div className="tasks">
          {open.map((w) => (
            <button
              key={w.id}
              className={`btn ${activeId === w.id ? 'pressed' : ''}`}
              onClick={() => (activeId === w.id ? minimize(w.id) : openWindow(w.id))}
            >
              {WINDOWS[w.id].icon} {WINDOWS[w.id].title}
            </button>
          ))}
        </div>
        <button className="btn small" onClick={() => setBoss(true)} title="Boss-Taste (F2)">
          📊 Boss
        </button>
        <div className="tray sunken">
          📯 {unread.length} · Anno {state.year}
        </div>
      </footer>

      {startOpen && (
        <div className="start-menu raised" role="menu" onPointerDown={(e) => e.stopPropagation()}>
          <div className="stripe">Kaiser-Klon 98</div>
          <ul>
            <MenuItem icon="👑" label="Thronsaal" onClick={() => openWindow('throne')} />
            <MenuItem icon="📯" label="Herold" onClick={() => openWindow('herald')} />
            <MenuItem icon="📖" label="Reichschronik" onClick={() => openWindow('chronicle')} />
            <li className="sep" />
            <MenuItem
              icon="💾"
              label="Spielstand speichern…"
              onClick={() => {
                setStartOpen(false);
                downloadSave(state);
              }}
            />
            <MenuItem icon="📂" label="Spielstand laden…" onClick={load} />
            <MenuItem icon="❓" label="Hilfe" onClick={() => openWindow('help')} />
            <li className="sep" />
            <MenuItem icon="🚪" label="Hauptmenü" onClick={onQuit} />
          </ul>
        </div>
      )}

      {/* ------------------------------------------------------- Dialoge */}
      {unread.length > 0 && !boss && (
        <Alert
          title={`Herold – ${unread[0].title}`}
          text={unread[0].text}
          severity={unread[0].severity}
          onOk={() => markRead(false)}
          counter={unread.length > 1 ? `Meldung 1 von ${unread.length}` : undefined}
          extra={
            unread.length > 1 ? (
              <button className="btn" onClick={() => markRead(true)}>
                Alle schließen
              </button>
            ) : undefined
          }
        />
      )}

      {confirmEnd && (
        <Modal title="Zug beenden" icon="❔" width={420} onClose={() => setConfirmEnd(false)}>
          <div className="alert-body">
            <div className="alert-icon" aria-hidden>
              {warnings.length ? '⚠️' : '❔'}
            </div>
            <div className="alert-text">
              {warnings.length > 0 ? (
                <>
                  <b>Euer Kanzler hat Bedenken:</b>
                  <ul style={{ margin: '4px 0', paddingLeft: 18 }}>
                    {warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                  Trotzdem das Jahr {state.year} beenden?
                </>
              ) : (
                <>Wollt Ihr das Jahr {state.year} wirklich beenden?</>
              )}
            </div>
          </div>
          <div className="btn-row">
            <button className="btn primary" onClick={endTurn} autoFocus>
              Ja
            </button>
            <button className="btn" onClick={() => setConfirmEnd(false)}>
              Nein
            </button>
          </div>
        </Modal>
      )}

      {confirmReset && (
        <Modal title="Zug zurücksetzen" icon="↩️" width={380} onClose={() => setConfirmReset(false)}>
          <div className="alert-body">
            <div className="alert-icon">❔</div>
            <div className="alert-text">Alle Befehle dieses Jahres verwerfen und zum Stand bei Zugbeginn zurückkehren?</div>
          </div>
          <div className="btn-row">
            <button
              className="btn primary"
              onClick={() => {
                setConfirmReset(false);
                onReset();
              }}
            >
              Ja
            </button>
            <button className="btn" onClick={() => setConfirmReset(false)}>
              Nein
            </button>
          </div>
        </Modal>
      )}

      {loadError && <Alert title="Laden fehlgeschlagen" text={loadError} severity="error" onOk={() => setLoadError(null)} />}
      {boss && <BossScreen onExit={() => setBoss(false)} />}
    </div>
  );
}

function Stat({ label, value, neg }: { label: string; value: string; neg?: boolean }) {
  return (
    <div className="stat sunken">
      <span className="label">{label}</span>
      <span className={`value ${neg ? 'neg' : ''}`}>{value}</span>
    </div>
  );
}

function MenuItem({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <li role="none">
      <button role="menuitem" onClick={onClick}>
        <span aria-hidden style={{ width: 20, textAlign: 'center' }}>
          {icon}
        </span>
        {label}
      </button>
    </li>
  );
}
