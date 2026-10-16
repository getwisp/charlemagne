import { useState } from 'react';
import { ARCHETYPES, type Archetype, type GameState, type PlayerSetup } from '../../engine';
import { GroupBox } from '../components/controls';
import { Alert, Modal } from '../components/Window';
import { loadAutosave, pickSaveFile } from '../storage';
import { PixelIcon } from '../icons';

type SlotType = 'human' | 'ai' | 'none';
interface Slot {
  type: SlotType;
  name: string;
  archetype: Archetype;
}

const DEFAULT_NAMES = ['Karl von Habsburg', 'Hanse von Lübeck', 'Albrecht von Wallenstein', 'Caterina de Medici', 'Clemens von Würzburg', 'Sophie von Hannover', 'August von Sachsen', 'Max von Bayern', 'Luise von Preußen'];
const ARCH_ORDER: Archetype[] = ['pfeffersack', 'kriegstreiber', 'raenkeschmiedin', 'kirchenfuerst'];

function defaultSlots(): Slot[] {
  return DEFAULT_NAMES.map((name, i) => ({
    type: i === 0 ? 'human' : i < 5 ? 'ai' : 'none',
    name,
    archetype: ARCH_ORDER[(i + 3) % 4],
  }));
}

export function Setup({ onStart, onLoad }: { onStart: (p: PlayerSetup[], endYear: number, seed?: number) => void; onLoad: (s: GameState) => void }) {
  const [slots, setSlots] = useState<Slot[]>(defaultSlots);
  const [endYear, setEndYear] = useState(1800);
  const [seed, setSeed] = useState('');
  const [error, setError] = useState<string | null>(null);
  const saved = loadAutosave();

  const update = (i: number, patch: Partial<Slot>) => setSlots((sl) => sl.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const active = slots.filter((s) => s.type !== 'none');
  const humans = active.filter((s) => s.type === 'human').length;

  function start() {
    if (humans === 0) return setError('Mindestens ein menschlicher Spieler wird benötigt.');
    if (active.length < 2) return setError('Mindestens zwei Spieler werden benötigt.');
    if (active.some((s) => !s.name.trim())) return setError('Jeder Spieler braucht einen Namen.');
    const parsed = seed.trim() ? Number.parseInt(seed, 10) : undefined;
    onStart(
      active.map((s) => ({ name: s.name.trim(), isAI: s.type === 'ai', archetype: s.type === 'ai' ? s.archetype : undefined })),
      endYear,
      Number.isFinite(parsed) ? parsed : undefined,
    );
  }

  async function loadFile() {
    try {
      onLoad(await pickSaveFile());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <Modal title="Kaiser-Klon Setup" icon="castle" width={620} opaque>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <PixelIcon name="castle" size={64} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 4 }}>Projekt Kaiser-Klon</div>
          <div className="hint">
            Heiliges Römisches Reich, Anno 1700. Vom einfachen Edlen bis zur Kaiserkrone – durch kluge Wirtschaft, Lehnswesen, Intrigen
            und Bestechung. Bis zu 9 Spieler: Hot-Seat am selben Rechner oder asynchron per Spielstand-Datei.
          </div>
        </div>
      </div>

      <GroupBox label="Teilnehmer">
        <div className="table-wrap sunken" style={{ maxHeight: 300 }}>
          <table className="grid">
            <thead>
              <tr>
                <th>#</th>
                <th>Typ</th>
                <th>Name</th>
                <th>Persönlichkeit (KI)</th>
              </tr>
            </thead>
            <tbody>
              {slots.map((s, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>
                    <select className="input" value={s.type} onChange={(e) => update(i, { type: e.target.value as SlotType })} aria-label={`Typ Spieler ${i + 1}`}>
                      <option value="human">Mensch</option>
                      <option value="ai">Computer</option>
                      <option value="none">— frei —</option>
                    </select>
                  </td>
                  <td>
                    <input className="input" value={s.name} disabled={s.type === 'none'} onChange={(e) => update(i, { name: e.target.value })} style={{ width: 190 }} aria-label={`Name Spieler ${i + 1}`} />
                  </td>
                  <td>
                    {s.type === 'ai' && (
                      <select className="input" value={s.archetype} onChange={(e) => update(i, { archetype: e.target.value as Archetype })} title={ARCHETYPES[s.archetype].description} aria-label={`Persönlichkeit Spieler ${i + 1}`}>
                        {ARCH_ORDER.map((a) => (
                          <option key={a} value={a}>
                            {ARCHETYPES[a].name}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="hint">
          {active.length} Spieler, davon {humans} Mensch(en). Pfeffersack: Handel · Kriegstreiber: Militär · Ränkeschmiedin: Spionage · Kirchenfürst: Kathedralen &amp; Bestechung.
        </div>
      </GroupBox>

      <GroupBox label="Optionen">
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <label>
            Spielende spätestens:{' '}
            <select className="input" value={endYear} onChange={(e) => setEndYear(Number(e.target.value))}>
              <option value={1750}>Anno 1750 (kurz)</option>
              <option value={1800}>Anno 1800 (normal)</option>
              <option value={1850}>Anno 1850 (lang)</option>
            </select>
          </label>
          <label>
            Startwert (Seed):{' '}
            <input className="input" value={seed} onChange={(e) => setSeed(e.target.value.replace(/[^0-9]/g, ''))} placeholder="zufällig" style={{ width: 90 }} />
          </label>
        </div>
      </GroupBox>

      <div className="btn-row">
        {saved && (
          <button className="btn" onClick={() => onLoad(saved.state)} title={`Gespeichert: ${new Date(saved.savedAt).toLocaleString('de-DE')}`}>
            Fortsetzen (Anno {saved.state.year})
          </button>
        )}
        <button className="btn" onClick={loadFile}>
          Laden…
        </button>
        <button className="btn primary" onClick={start}>
          Spiel starten
        </button>
      </div>
      {error && <Alert title="Setup" text={error} severity="warning" onOk={() => setError(null)} />}
    </Modal>
  );
}
