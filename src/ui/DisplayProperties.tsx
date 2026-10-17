import { useState } from 'react';
import { GroupBox, Tabs } from './components/controls';
import { Modal } from './components/Window';
import { PixelIcon } from './icons';
import { loadSaver, previewSaver, SAVER_MINUTES, SAVER_MODES, saveSaver, type SaverMode, type SaverSettings } from './Screensaver';

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

type Tab = 'background' | 'saver';

/** „Eigenschaften von Anzeige": Hintergrundfarbe und Bildschirmschoner, mit Monitor-Vorschau. */
export function DisplayProperties({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('background');
  const [color, setColor] = useState(loadDesktopColor);
  const [saver, setSaver] = useState<SaverSettings>(loadSaver);
  const [applied, setApplied] = useState(() => JSON.stringify([loadDesktopColor(), loadSaver()]));
  const dirty = JSON.stringify([color, saver]) !== applied;

  function apply() {
    applyDesktopColor(color);
    saveSaver(saver);
    setApplied(JSON.stringify([color, saver]));
  }

  return (
    <Modal title="Eigenschaften von Anzeige" icon="monitor" width={380} onClose={onClose}>
      <Tabs
        tabs={[
          { id: 'background', label: 'Hintergrund' },
          { id: 'saver', label: 'Bildschirmschoner' },
        ]}
        active={tab}
        onChange={setTab}
      />
      <div className="tab-panel">
        <div className="monitor-preview" aria-hidden>
          <div className="monitor-screen" style={{ background: tab === 'saver' && saver.mode !== 'none' ? '#000' : color }}>
            {tab === 'saver' && saver.mode === 'stars' && <div className="monitor-stars" />}
            {tab === 'saver' && saver.mode === 'crests' && (
              <>
                <PixelIcon name="castle" size={32} className="monitor-crest" />
                <PixelIcon name="throne" size={32} className="monitor-crest second" />
              </>
            )}
            {(tab === 'background' || saver.mode === 'none') && (
              <div className="monitor-window raised">
                <div className="titlebar" />
              </div>
            )}
          </div>
          <div className="monitor-foot" />
        </div>
        {tab === 'background' ? (
          <GroupBox label="Hintergrundfarbe">
            <select className="input" style={{ width: '100%' }} value={color} onChange={(e) => setColor(e.target.value)} aria-label="Hintergrundfarbe">
              {DESKTOP_COLORS.map((c) => (
                <option key={c.color} value={c.color}>
                  {c.name}
                </option>
              ))}
            </select>
          </GroupBox>
        ) : (
          <GroupBox label="Bildschirmschoner">
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <select className="input" style={{ flex: 1 }} value={saver.mode} onChange={(e) => setSaver({ ...saver, mode: e.target.value as SaverMode })} aria-label="Bildschirmschoner">
                {SAVER_MODES.map((m) => (
                  <option key={m.mode} value={m.mode}>
                    {m.name}
                  </option>
                ))}
              </select>
              <button className="btn" disabled={saver.mode === 'none'} onClick={() => previewSaver(saver.mode)}>
                Vorschau
              </button>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6 }}>
              Wartezeit:
              <select
                className="input"
                value={saver.minutes}
                disabled={saver.mode === 'none'}
                onChange={(e) => setSaver({ ...saver, minutes: Number(e.target.value) })}
                aria-label="Wartezeit"
              >
                {SAVER_MINUTES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              Minuten
            </div>
          </GroupBox>
        )}
      </div>
      <div className="btn-row">
        <button
          className="btn primary"
          onClick={() => {
            apply();
            onClose();
          }}
        >
          OK
        </button>
        <button className="btn" onClick={onClose}>
          Abbrechen
        </button>
        <button className="btn" disabled={!dirty} onClick={apply}>
          Übernehmen
        </button>
      </div>
    </Modal>
  );
}
