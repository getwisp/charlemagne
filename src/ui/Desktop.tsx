import { useCallback, useEffect, useMemo, useState, type ComponentType } from 'react';
import {
  actions,
  previewEconomy,
  cityCount,
  fiefLand,
  freeLand,
  builtLand,
  expectedHarvest,
  grainNeed,
  HECTARES_PER_BUILDING,
  TITLES,
  type GameState,
  type HeraldMessage,
  type HistoryEntry,
  type Severity,
} from '../engine';
import { BossScreen } from './BossScreen';
import { n } from './components/controls';
import { ContextMenu, type MenuEntry } from './components/Menu';
import { Alert, Modal, SEVERITY_ICON, Window } from './components/Window';
import { DisplayProperties } from './DisplayProperties';
import { StartMenu } from './StartMenu';
import { onSoundChange, playSound, setSoundEnabled, soundEnabled } from './sound';
import { zoomFromTask, zoomToTask } from './zoom';
import { PixelIcon, type IconName } from './icons';
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
  icon: IconName;
  width: number;
  component: ComponentType<{ read: HeraldMessage[] }>;
  desktop: boolean;
}

const WINDOWS: Record<WinId, WinDef> = {
  granary: { title: 'Kornkammer', icon: 'granary', width: 430, component: GranaryWindow, desktop: true },
  market: { title: 'Marktplatz', icon: 'market', width: 430, component: MarketWindow, desktop: true },
  build: { title: 'Bauamt', icon: 'build', width: 560, component: BuildWindow, desktop: true },
  treasury: { title: 'Schatzamt', icon: 'treasury', width: 480, component: TreasuryWindow, desktop: true },
  bank: { title: 'Bankhaus Fugger', icon: 'bank', width: 520, component: BankWindow, desktop: true },
  barracks: { title: 'Kaserne', icon: 'barracks', width: 640, component: BarracksWindow, desktop: true },
  tavern: { title: 'Taverne „Zum goldenen Dolch“', icon: 'tavern', width: 520, component: TavernWindow, desktop: true },
  throne: { title: 'Thronsaal', icon: 'throne', width: 600, component: ThroneWindow, desktop: true },
  stats: { title: 'Statistik', icon: 'stats', width: 520, component: StatsWindow, desktop: true },
  chronicle: { title: 'Reichschronik', icon: 'chronicle', width: 460, component: ChronicleWindow, desktop: true },
  herald: { title: 'Herold', icon: 'herald', width: 460, component: HeraldWindow, desktop: true },
  help: { title: 'Hilfe', icon: 'help', width: 560, component: HelpWindow, desktop: true },
};

interface OpenWin {
  id: WinId;
  x: number;
  y: number;
  z: number;
  minimized: boolean;
  maximized?: boolean;
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
  const [open, setOpen] = useState<OpenWin[]>(() => loadLayout(state.id, me.id));
  const [zTop, setZTop] = useState(10);
  const [startOpen, setStartOpen] = useState(false);
  const [boss, setBoss] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [readThisTurn, setReadThisTurn] = useState<HeraldMessage[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedIcon, setSelectedIcon] = useState<WinId | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; kind: 'desktop' | 'taskbar' } | null>(null);
  const [displayProps, setDisplayProps] = useState(false);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const clock = useClock();
  const sound = useSoundSetting();

  // Startklang einmal pro Sitzung, wenn der Desktop zum ersten Mal erscheint
  useEffect(() => {
    if (startupPlayed) return;
    startupPlayed = true;
    playSound('start');
  }, []);

  const unread = state.messages[me.id] ?? [];
  const preview = useMemo(() => previewEconomy(state, me), [me, state]);

  // Fensterlayout bleibt pro Spieler erhalten (Jahreswechsel, Hot-Seat, Neuladen).
  useEffect(() => {
    setOpen(loadLayout(state.id, me.id));
  }, [state.id, me.id]);
  useEffect(() => saveLayout(state.id, me.id, open), [state.id, me.id, open]);
  useEffect(() => {
    setZTop((z) => Math.max(z, ...open.map((w) => w.z)));
  }, [open]);

  // Neues Jahr → Herold-Archiv leeren
  useEffect(() => {
    setReadThisTurn([]);
  }, [me.id, state.year]);

  // Boss-Taste: F2 (oder Esc zum Zurückkehren)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && e.ctrlKey) {
        // Strg+Esc öffnet das Startmenü wie bei Windows 95
        e.preventDefault();
        setStartOpen((o) => !o);
        return;
      }
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
      if (existing) {
        if (existing.minimized) zoomFromTask(id);
        return ws.map((w) => (w.id === id ? { ...w, z, minimized: false } : w));
      }
      const narrow = window.innerWidth < 700;
      if (narrow) return [...ws, { id, x: 2, y: 2, z, minimized: false }];
      // Neben die offenen Fenster stellen, damit nichts verdeckt wird; erst wenn kein Platz ist, kaskadieren.
      const desk = document.querySelector('.desktop')?.getBoundingClientRect();
      const deskWidth = desk?.width ?? window.innerWidth - 220;
      // Fenster beginnen rechts neben den Desktop-Symbolen, damit keines verdeckt wird.
      const iconsRight = (document.querySelector('.icons')?.getBoundingClientRect().right ?? 100) - (desk?.left ?? 0);
      const start = Math.min(Math.round(iconsRight + 8), Math.max(8, deskWidth - WINDOWS[id].width - 8));
      const visible = ws.filter((w) => !w.minimized);
      const right = Math.max(start, ...visible.map((w) => w.x + WINDOWS[w.id].width + 8));
      if (right + WINDOWS[id].width <= deskWidth) return [...ws, { id, x: right, y: 10, z, minimized: false }];
      const offset = (ws.length % 6) * 24;
      return [...ws, { id, x: start + offset, y: 10 + offset, z, minimized: false }];
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
  const minimize = (id: WinId) => {
    zoomToTask(id);
    setOpen((ws) => ws.map((w) => (w.id === id ? { ...w, minimized: true } : w)));
  };
  const toggleMaximize = (id: WinId) => setOpen((ws) => ws.map((w) => (w.id === id ? { ...w, maximized: !w.maximized } : w)));
  const closeMenu = useCallback(() => setMenu(null), []);

  /** Linke Kante für Fenster: rechts neben den Desktop-Symbolen. */
  function windowArea() {
    const desk = document.querySelector('.desktop')?.getBoundingClientRect();
    const iconsRight = (document.querySelector('.icons')?.getBoundingClientRect().right ?? 100) - (desk?.left ?? 0);
    return { left: Math.round(iconsRight + 8), width: desk?.width ?? window.innerWidth, height: desk?.height ?? window.innerHeight };
  }
  // Neue Positionen außerhalb des State-Updaters berechnen: Updater müssen rein sein (StrictMode ruft sie doppelt auf).
  function cascade() {
    const { left } = windowArea();
    const next = open.map((w, i) => ({ ...w, x: left + i * 24, y: 8 + i * 24, z: zTop + 1 + i, minimized: false, maximized: false }));
    setZTop(zTop + open.length);
    setOpen(next);
  }
  function tile() {
    const { left, width } = windowArea();
    let x = left;
    let y = 8;
    let rowHeight = 0;
    const next = open.map((w) => {
      const wWidth = WINDOWS[w.id].width;
      if (x + wWidth > width && x > left) {
        x = left;
        y += rowHeight + 8;
        rowHeight = 0;
      }
      const placed = { ...w, x, y, minimized: false, maximized: false };
      x += wWidth + 8;
      rowHeight = Math.max(rowHeight, document.querySelector<HTMLElement>(`[data-win="${w.id}"]`)?.offsetHeight ?? 300);
      return placed;
    });
    setOpen(next);
  }
  function minimizeAll() {
    setOpen((ws) => ws.map((w) => ({ ...w, minimized: true })));
  }
  const arrangeItems: MenuEntry[] = [
    { label: 'Überlappend', onClick: cascade, disabled: open.length === 0 },
    { label: 'Nebeneinander', onClick: tile, disabled: open.length === 0 },
    { label: 'Alle Fenster &minimieren', onClick: minimizeAll, disabled: open.every((w) => w.minimized) },
  ];

  function onIconKey(e: React.KeyboardEvent<HTMLDivElement>) {
    const ids = (Object.keys(WINDOWS) as WinId[]).filter((id) => WINDOWS[id].desktop);
    const cur = ids.indexOf(selectedIcon ?? ids[0]);
    if (e.key === 'Enter' && selectedIcon) {
      e.preventDefault();
      openWindow(selectedIcon);
      return;
    }
    // Spaltenweise angeordnet: hoch/runter = ±1, links/rechts = ± Symbole je Spalte
    const buttons = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('.icon')];
    const perColumn = Math.max(1, buttons.filter((b) => b.offsetLeft === buttons[0].offsetLeft).length);
    const step = { ArrowDown: 1, ArrowUp: -1, ArrowRight: perColumn, ArrowLeft: -perColumn }[e.key];
    if (step === undefined) return;
    e.preventDefault();
    const next = Math.min(ids.length - 1, Math.max(0, cur + step));
    setSelectedIcon(ids[next]);
    buttons[next]?.focus();
  }
  const move = (id: WinId, x: number, y: number) => setOpen((ws) => ws.map((w) => (w.id === id ? { ...w, x, y } : w)));
  const activeId = open.filter((w) => !w.minimized).sort((a, b) => b.z - a.z)[0]?.id;

  function markAllRead() {
    if (unread.length === 0) return;
    setReadThisTurn((r) => [...r, ...unread]);
    setRaw({ ...state, messages: { ...state.messages, [me.id]: [] } });
  }

  // Veränderung im letzten Jahr (Jahresende gegen Jahresende davor)
  const [prevYear, lastYear] = me.history.slice(-2);
  const delta = (pick: (h: HistoryEntry) => number | undefined): number | undefined => {
    if (!prevYear || !lastYear) return undefined;
    const a = pick(prevYear);
    const b = pick(lastYear);
    return a === undefined || b === undefined ? undefined : b - a;
  };

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
              <PixelIcon name="chain" /> Ihr seid im <b>{blocked}</b> und könnt dieses Jahr nichts befehlen.
            </div>
          )}
          <Stat icon="gold" label="Gold" value={`${n(me.gold)}`} neg={me.gold < 0} delta={delta((h) => h.cash)} />
          <Stat icon="bank" label="Sparkonto" value={n(me.savings)} />
          <Stat icon="granary" label="Korn" value={`${n(me.grain)} Sch.`} delta={delta((h) => h.grain)} />
          <Stat icon="land" label="Land" value={`${n(me.land)} ha`} delta={delta((h) => h.land)} title="Gesamtland = bebautes Land + Lehnsland + freies Ackerland" />
          <Stat
            icon="sprout"
            label="Freies Ackerland"
            value={`${n(freeLand(me))} ha`}
            warn={freeLand(me) < HECTARES_PER_BUILDING}
            title={
              `Reicht für ${Math.floor(freeLand(me) / HECTARES_PER_BUILDING)} Gebäude (je ${n(HECTARES_PER_BUILDING)} ha). ` +
              `Bei normalem Wetter deckt die Ernte ~${grainNeed(me) > 0 ? Math.round((expectedHarvest(me, 1) / grainNeed(me)) * 100) : 100} % des Kornbedarfs.`
            }
          />
          <div className="hint" style={{ margin: '-2px 4px 0' }}>
            bebaut {n(builtLand(me))} · Lehen {n(fiefLand(me))}
          </div>
          <Stat icon="people" label="Bürger" value={n(me.population)} delta={delta((h) => h.population)} />
          <Stat icon="cities" label="Städte" value={`${cityCount(me.buildings)}`} />
          <Stat icon="army" label="Garde / Heer" value={`${n(me.military.guards)} / ${n(me.military.mercenaries + me.military.cannons + me.military.squires + me.military.knights)}`} />
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
              <PixelIcon name="ballot" /> Reichstag {state.election.year}!
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
      <main
        className="desktop"
        aria-label="Desktop"
        onPointerDown={(e) => {
          if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('icons')) setSelectedIcon(null);
        }}
        onContextMenu={(e) => {
          if (e.target !== e.currentTarget && !(e.target as HTMLElement).classList.contains('icons')) return;
          e.preventDefault();
          setMenu({ x: e.clientX, y: e.clientY, kind: 'desktop' });
        }}
      >
        <div className="icons" onKeyDown={onIconKey}>
          {(Object.keys(WINDOWS) as WinId[])
            .filter((id) => WINDOWS[id].desktop)
            .map((id) => (
              <button
                key={id}
                className={`icon ${selectedIcon === id ? 'selected' : ''}`}
                onFocus={() => setSelectedIcon(id)}
                // Maus: einfacher Klick markiert, Doppelklick öffnet. Finger und Stift öffnen mit einem Tipp.
                onPointerUp={(e) => {
                  if (e.pointerType !== 'mouse') openWindow(id);
                }}
                onClick={() => setSelectedIcon(id)}
                onDoubleClick={() => openWindow(id)}
                title="Doppelklick zum Öffnen"
              >
                <span className="glyph">
                  <PixelIcon name={WINDOWS[id].icon} size={32} />
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
                winId={w.id}
                maximized={w.maximized}
                active={activeId === w.id}
                onFocus={() => focus(w.id)}
                onClose={() => close(w.id)}
                onMinimize={() => minimize(w.id)}
                onMaximize={() => toggleMaximize(w.id)}
                onMove={(x, y) => move(w.id, x, y)}
              >
                <C read={readThisTurn} />
              </Window>
            );
          })}
      </main>

      {/* ------------------------------------------------------- Taskleiste */}
      <footer
        className="taskbar"
        onContextMenu={(e) => {
          if ((e.target as HTMLElement).closest('.start')) return;
          e.preventDefault();
          setMenu({ x: e.clientX, y: e.clientY, kind: 'taskbar' });
        }}
      >
        <button
          className={`btn start ${startOpen ? 'pressed' : ''}`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setStartOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={startOpen}
        >
          <PixelIcon name="castle" /> Start
        </button>
        <div className="tasks">
          {open.map((w) => (
            <button
              key={w.id}
              data-task={w.id}
              className={`btn ${activeId === w.id ? 'pressed' : ''}`}
              onClick={() => (activeId === w.id ? minimize(w.id) : openWindow(w.id))}
            >
              <PixelIcon name={WINDOWS[w.id].icon} /> {WINDOWS[w.id].title}
            </button>
          ))}
        </div>
        <button className="btn small" onClick={() => setBoss(true)} title="Boss-Taste (F2)">
          <PixelIcon name="spreadsheet" /> Boss
        </button>
        <div className="tray sunken">
          <button className="tray-icon" onClick={() => setSoundEnabled(!sound)} title={sound ? 'Klänge an – klicken zum Stummschalten' : 'Klänge aus – klicken zum Einschalten'} aria-label="Lautstärke">
            <PixelIcon name={sound ? 'speaker' : 'speakerOff'} />
          </button>
          <button className="tray-icon" onClick={() => openWindow('herald')} title={unread.length ? `${unread.length} ungelesene Meldung(en)` : 'Herold'}>
            <PixelIcon name="herald" />
            {unread.length > 0 && <span className="tray-badge">{unread.length}</span>}
          </button>
          <span title={clock.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}>
            {clock.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </span>
          <span className="tray-year">Anno {state.year}</span>
        </div>
      </footer>

      {startOpen && (
        <StartMenu
          onClose={() => setStartOpen(false)}
          folders={[
            {
              key: 'programs',
              label: 'Programme',
              icon: 'folder',
              items: (Object.keys(WINDOWS) as WinId[]).map((id) => ({ label: WINDOWS[id].title, icon: WINDOWS[id].icon, onClick: () => openWindow(id) })),
            },
            {
              key: 'save',
              label: 'Spielstand',
              icon: 'disk',
              items: [
                { label: 'Speichern unter…', icon: 'disk', onClick: () => downloadSave(state) },
                { label: 'Öffnen…', icon: 'folder', onClick: load },
              ],
            },
            {
              key: 'settings',
              label: 'Einstellungen',
              icon: 'settings',
              items: [
                { label: 'Anzeige…', icon: 'monitor', onClick: () => setDisplayProps(true) },
                { label: sound ? 'Klänge ausschalten' : 'Klänge einschalten', icon: sound ? 'speakerOff' : 'speaker', onClick: () => setSoundEnabled(!sound) },
                'sep',
                ...arrangeItems,
                { label: 'Fensterlayout zurücksetzen', onClick: () => setOpen([]) },
              ],
            },
          ]}
          items={[
            { label: 'Hilfe', icon: 'help', onClick: () => openWindow('help') },
            { label: 'Boss-&Taste (F2)', icon: 'spreadsheet', onClick: () => setBoss(true) },
            'sep',
            { label: 'Beenden…', icon: 'door', onClick: () => setConfirmQuit(true) },
          ]}
        />
      )}

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={closeMenu}
          items={
            menu.kind === 'desktop'
              ? [...arrangeItems, 'sep', { label: 'Eigenschaften', icon: 'monitor', onClick: () => setDisplayProps(true) }]
              : [...arrangeItems, 'sep', { label: 'Herold öffnen', icon: 'herald', onClick: () => openWindow('herald') }]
          }
        />
      )}
      {displayProps && <DisplayProperties onClose={() => setDisplayProps(false)} />}
      {confirmQuit && (
        <Modal title="Karl 98 beenden" icon="door" width={380} onClose={() => setConfirmQuit(false)}>
          <div className="alert-body">
            <div className="alert-icon">
              <PixelIcon name="castle" size={32} />
            </div>
            <div className="alert-text">Wollt Ihr zum Hauptmenü zurückkehren? Der Spielstand ist automatisch gesichert und kann dort fortgesetzt werden.</div>
          </div>
          <div className="btn-row">
            <button className="btn primary" autoFocus onClick={onQuit}>
              Ja
            </button>
            <button className="btn" onClick={() => setConfirmQuit(false)}>
              Nein
            </button>
          </div>
        </Modal>
      )}

      {/* ------------------------------------------------------- Dialoge */}
      {unread.length > 0 && !boss && <HeraldReport year={state.year} messages={unread} onOk={markAllRead} />}

      {confirmEnd && (
        <Modal title="Zug beenden" icon="question" width={420} onClose={() => setConfirmEnd(false)}>
          <div className="alert-body">
            <div className="alert-icon">
              <PixelIcon name={warnings.length ? 'warning' : 'question'} size={32} />
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
        <Modal title="Zug zurücksetzen" icon="question" width={380} onClose={() => setConfirmReset(false)}>
          <div className="alert-body">
            <div className="alert-icon">
              <PixelIcon name="question" size={32} />
            </div>
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

const SEVERITY_ORDER: Record<Severity, number> = { error: 0, warning: 1, good: 2, info: 3 };

/** Jahresbericht des Herolds: alle Meldungen in einer Box, Wichtiges zuerst. */
function HeraldReport({ year, messages, onOk }: { year: number; messages: HeraldMessage[]; onOk: () => void }) {
  const sorted = [...messages].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  const worst = sorted[0].severity;
  const promoted = messages.some((m) => m.title === 'Beförderung!');
  useEffect(() => {
    playSound(promoted ? 'fanfare' : worst === 'error' ? 'chord' : 'ding');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);
  return (
    <Modal title={`Herold – Anno ${year}`} icon="herald" width={500}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '4px 4px 8px' }}>
        <div className="alert-icon">
          <PixelIcon name={SEVERITY_ICON[worst]} size={32} />
        </div>
        <div>
          Der Herold verkündet {messages.length === 1 ? 'eine Meldung' : `${messages.length} Meldungen`} zum Jahreswechsel.
        </div>
      </div>
      <div className="sunken field scroll-area" style={{ maxHeight: '55vh', userSelect: 'text' }}>
        {sorted.map((m) => (
          <div key={m.id} className={`herald-item herald-${m.severity}`}>
            <div>
              <PixelIcon name={SEVERITY_ICON[m.severity]} /> <b>{m.title}</b>
            </div>
            <div style={{ whiteSpace: 'pre-wrap', paddingLeft: 22 }}>{m.text}</div>
          </div>
        ))}
      </div>
      <div className="btn-row" style={{ justifyContent: 'center' }}>
        <button className="btn primary" onClick={onOk} autoFocus>
          OK
        </button>
      </div>
    </Modal>
  );
}

function Stat({
  icon,
  label,
  value,
  neg,
  warn,
  title,
  delta,
}: {
  icon?: IconName;
  label: string;
  value: string;
  neg?: boolean;
  warn?: boolean;
  title?: string;
  /** Veränderung im letzten Jahr */
  delta?: number;
}) {
  const d = delta !== undefined ? Math.round(delta) : 0;
  const deltaTitle = d !== 0 ? `Im letzten Jahr: ${d > 0 ? '+' : ''}${n(d)}` : undefined;
  return (
    <div className="stat sunken" title={[title, deltaTitle].filter(Boolean).join(' – ') || undefined}>
      <span className="label">
        {icon && <PixelIcon name={icon} />} {label}
      </span>
      <span className={`value ${neg ? 'neg' : warn ? 'warn' : ''}`}>
        {d !== 0 && <span className={`delta ${d > 0 ? 'pos' : 'neg'}`}>{d > 0 ? '▲' : '▼'}</span>}
        {value}
      </span>
    </div>
  );
}

let startupPlayed = false;

function useSoundSetting(): boolean {
  const [on, setOn] = useState(soundEnabled);
  useEffect(() => onSoundChange(setOn), []);
  return on;
}

/** Uhrzeit für den Infobereich, minütlich aktualisiert. */
function useClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(t);
  }, []);
  return now;
}

// ------------------------------------------------------------ Fensterlayout pro Spieler
const LAYOUT_KEY = (gameId: string, playerId: string) => `kaiser-klon/layout/${gameId}/${playerId}`;

function loadLayout(gameId: string, playerId: string): OpenWin[] {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY(gameId, playerId));
    const parsed = raw ? (JSON.parse(raw) as OpenWin[]) : [];
    const maxX = Math.max(0, window.innerWidth - 120);
    const maxY = Math.max(0, window.innerHeight - 120);
    // Nur bekannte Fenster, und nie außerhalb des sichtbaren Bereichs
    return parsed
      .filter((w) => w && w.id in WINDOWS)
      .map((w) => ({ ...w, x: Math.min(Math.max(0, w.x), maxX), y: Math.min(Math.max(0, w.y), maxY) }));
  } catch {
    return [];
  }
}

function saveLayout(gameId: string, playerId: string, open: OpenWin[]): void {
  try {
    localStorage.setItem(LAYOUT_KEY(gameId, playerId), JSON.stringify(open));
  } catch {
    // Kein Speicher verfügbar – Layout gilt dann nur für diese Sitzung.
  }
}
