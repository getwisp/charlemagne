import { useState } from 'react';
import { GroupBox } from './components/controls';
import { Modal } from './components/Window';

export const DESKTOP_COLORS: { name: string; color: string }[] = [
  { name: 'Petrol (Standard)', color: '#008080' },
  { name: 'Marine', color: '#000080' },
  { name: 'Tannengrün', color: '#004000' },
  { name: 'Ochsenblut', color: '#800000' },
  { name: 'Purpur', color: '#400040' },
  { name: 'Schiefer', color: '#404040' },
  { name: 'Schwarz', color: '#000000' },
  { name: 'Olive', color: '#808000' },
];

const KEY = 'kaiser-klon/desktop-color';

export function loadDesktopColor(): string {
  try {
    return localStorage.getItem(KEY) ?? DESKTOP_COLORS[0].color;
  } catch {
    return DESKTOP_COLORS[0].color;
  }
}

export function applyDesktopColor(color: string, persist = true): void {
  document.documentElement.style.setProperty('--desktop', color);
  if (!persist) return;
  try {
    localStorage.setItem(KEY, color);
  } catch {
    // Ohne Speicher gilt die Farbe nur für diese Sitzung.
  }
}

/** „Eigenschaften von Anzeige": Hintergrundfarbe des Desktops mit Monitor-Vorschau. */
export function DisplayProperties({ onClose }: { onClose: () => void }) {
  const [color, setColor] = useState(loadDesktopColor);
  const [applied, setApplied] = useState(loadDesktopColor);
  return (
    <Modal title="Eigenschaften von Anzeige" icon="monitor" width={360} onClose={onClose}>
      <div className="monitor-preview" aria-hidden>
        <div className="monitor-screen" style={{ background: color }}>
          <div className="monitor-window raised">
            <div className="titlebar" />
          </div>
        </div>
        <div className="monitor-foot" />
      </div>
      <GroupBox label="Hintergrund">
        <select className="input" size={6} style={{ width: '100%' }} value={color} onChange={(e) => setColor(e.target.value)} aria-label="Hintergrundfarbe">
          {DESKTOP_COLORS.map((c) => (
            <option key={c.color} value={c.color}>
              {c.name}
            </option>
          ))}
        </select>
      </GroupBox>
      <div className="btn-row">
        <button
          className="btn primary"
          onClick={() => {
            applyDesktopColor(color);
            onClose();
          }}
        >
          OK
        </button>
        <button className="btn" onClick={onClose}>
          Abbrechen
        </button>
        <button
          className="btn"
          disabled={color === applied}
          onClick={() => {
            applyDesktopColor(color);
            setApplied(color);
          }}
        >
          Übernehmen
        </button>
      </div>
    </Modal>
  );
}
