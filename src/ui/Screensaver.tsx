import { useEffect, useRef, useState } from 'react';
import { ICONS, type IconName } from './icons';

export type SaverMode = 'none' | 'stars' | 'crests';
export interface SaverSettings {
  mode: SaverMode;
  minutes: number;
}

export const SAVER_MODES: { mode: SaverMode; name: string }[] = [
  { mode: 'none', name: '(Kein)' },
  { mode: 'stars', name: 'Sternenfeld' },
  { mode: 'crests', name: 'Fliegende Wappen' },
];
export const SAVER_MINUTES = [1, 3, 5, 10, 15];

const KEY = 'kaiser-klon/screensaver';
const DEFAULTS: SaverSettings = { mode: 'stars', minutes: 5 };
const CHANGE = 'kaiser-klon:screensaver';
const PREVIEW = 'kaiser-klon:screensaver-preview';

export function loadSaver(): SaverSettings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<SaverSettings>) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

export function saveSaver(settings: SaverSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // nur für diese Sitzung
  }
  window.dispatchEvent(new CustomEvent(CHANGE, { detail: settings }));
}

export function previewSaver(mode: SaverMode): void {
  window.dispatchEvent(new CustomEvent(PREVIEW, { detail: mode }));
}

/** Bildschirmschoner: startet nach einigen Minuten ohne Eingabe, jede Eingabe beendet ihn. */
export function ScreensaverHost() {
  const [settings, setSettings] = useState(loadSaver);
  const [active, setActive] = useState<SaverMode | null>(null);
  const last = useRef(Date.now());

  useEffect(() => {
    const onChange = (e: Event) => setSettings((e as CustomEvent<SaverSettings>).detail);
    const onPreview = (e: Event) => {
      // Kurz warten, damit der auslösende Klick den Schoner nicht gleich wieder beendet
      setTimeout(() => setActive((e as CustomEvent<SaverMode>).detail), 300);
    };
    window.addEventListener(CHANGE, onChange);
    window.addEventListener(PREVIEW, onPreview);
    return () => {
      window.removeEventListener(CHANGE, onChange);
      window.removeEventListener(PREVIEW, onPreview);
    };
  }, []);

  useEffect(() => {
    if (active) return;
    const bump = () => (last.current = Date.now());
    const events = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
    events.forEach((ev) => window.addEventListener(ev, bump, { capture: true, passive: true }));
    const check = setInterval(() => {
      if (settings.mode !== 'none' && Date.now() - last.current > settings.minutes * 60_000 && !document.hidden) setActive(settings.mode);
    }, 2000);
    return () => {
      events.forEach((ev) => window.removeEventListener(ev, bump, { capture: true }));
      clearInterval(check);
    };
  }, [active, settings]);

  if (!active || active === 'none') return null;
  return (
    <Saver
      mode={active}
      onExit={() => {
        last.current = Date.now();
        setActive(null);
      }}
    />
  );
}

const CREST_ICONS: IconName[] = ['castle', 'throne', 'church', 'treasury', 'barracks', 'chronicle'];
const PALETTE_RGB: Record<string, string> = {
  k: '#000000', w: '#ffffff', g: '#c0c0c0', d: '#808080', r: '#ff0000', m: '#800000', y: '#ffff00', o: '#808000',
  l: '#00ff00', G: '#008000', c: '#00ffff', t: '#008080', b: '#0000ff', n: '#000080', p: '#ff00ff', u: '#800080',
};

function Saver({ mode, onExit }: { mode: SaverMode; onExit: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  // Jede Eingabe beendet den Schoner – und wird verschluckt, damit z. B. F2 nichts auslöst.
  useEffect(() => {
    let origin: { x: number; y: number } | null = null;
    const stop = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      onExit();
    };
    const move = (e: PointerEvent) => {
      origin ??= { x: e.clientX, y: e.clientY };
      if (Math.abs(e.clientX - origin.x) + Math.abs(e.clientY - origin.y) > 8) onExit();
    };
    window.addEventListener('keydown', stop, true);
    window.addEventListener('pointerdown', stop, true);
    window.addEventListener('wheel', stop, true);
    window.addEventListener('pointermove', move, true);
    return () => {
      window.removeEventListener('keydown', stop, true);
      window.removeEventListener('pointerdown', stop, true);
      window.removeEventListener('wheel', stop, true);
      window.removeEventListener('pointermove', move, true);
    };
  }, [onExit]);

  useEffect(() => {
    const c = canvas.current;
    const g = c?.getContext('2d');
    if (!c || !g) return;
    let w = (c.width = window.innerWidth);
    let h = (c.height = window.innerHeight);
    const resize = () => {
      w = c.width = window.innerWidth;
      h = c.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    let raf = 0;

    if (mode === 'stars') {
      // Sterne fliegen aus der Mitte auf den Betrachter zu.
      const stars = Array.from({ length: 220 }, () => ({ x: (Math.random() - 0.5) * 2, y: (Math.random() - 0.5) * 2, z: Math.random() }));
      const draw = () => {
        g.fillStyle = '#000';
        g.fillRect(0, 0, w, h);
        for (const s of stars) {
          s.z -= 0.006;
          if (s.z <= 0.02) {
            s.x = (Math.random() - 0.5) * 2;
            s.y = (Math.random() - 0.5) * 2;
            s.z = 1;
          }
          const px = w / 2 + (s.x / s.z) * (w / 2);
          const py = h / 2 + (s.y / s.z) * (h / 2);
          const size = Math.max(1, Math.round((1 - s.z) * 3));
          const shade = Math.round(255 * (1 - s.z * 0.7));
          g.fillStyle = `rgb(${shade},${shade},${shade})`;
          g.fillRect(Math.round(px), Math.round(py), size, size);
        }
        raf = requestAnimationFrame(draw);
      };
      draw();
    } else {
      // Pixel-Wappen treiben über den Schirm und prallen an den Rändern ab.
      const scale = 4;
      const crests = CREST_ICONS.map((icon) => ({
        icon,
        x: Math.random() * (w - 64),
        y: Math.random() * (h - 64),
        vx: (Math.random() < 0.5 ? -1 : 1) * (1 + Math.random() * 1.5),
        vy: (Math.random() < 0.5 ? -1 : 1) * (1 + Math.random() * 1.5),
      }));
      const draw = () => {
        g.fillStyle = '#000';
        g.fillRect(0, 0, w, h);
        for (const cr of crests) {
          cr.x += cr.vx;
          cr.y += cr.vy;
          if (cr.x < 0 || cr.x > w - 16 * scale) cr.vx *= -1;
          if (cr.y < 0 || cr.y > h - 16 * scale) cr.vy *= -1;
          ICONS[cr.icon].forEach((row, ry) => {
            for (let rx = 0; rx < row.length; rx++) {
              const ch = row[rx];
              if (ch === '.') continue;
              g.fillStyle = PALETTE_RGB[ch];
              g.fillRect(Math.round(cr.x) + rx * scale, Math.round(cr.y) + ry * scale, scale, scale);
            }
          });
        }
        raf = requestAnimationFrame(draw);
      };
      draw();
    }
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [mode]);

  return <canvas ref={canvas} className="screensaver" aria-label="Bildschirmschoner – beliebige Taste beendet ihn" />;
}
