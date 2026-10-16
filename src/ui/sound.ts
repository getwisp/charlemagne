// Systemklänge, synthetisch mit der Web Audio API erzeugt – eigene Klänge im
// Geist der Neunziger, keine Originale. Standardmäßig AUS (Büro, Boss-Taste …).

export type SoundName = 'start' | 'ding' | 'chord' | 'fanfare';

const KEY = 'kaiser-klon/sound';
let ctx: AudioContext | null = null;
let enabled = readEnabled();
const listeners = new Set<(on: boolean) => void>();

function readEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) === 'on';
  } catch {
    return false;
  }
}

export function soundEnabled(): boolean {
  return enabled;
}

export function setSoundEnabled(on: boolean): void {
  enabled = on;
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off');
  } catch {
    // nur für diese Sitzung
  }
  listeners.forEach((l) => l(on));
  if (on) playSound('ding');
}

export function onSoundChange(fn: (on: boolean) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx ??= new Ctor();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** Ein Ton mit weichem Einsatz und exponentiellem Ausklang. */
function tone(ac: AudioContext, out: AudioNode, freq: number, start: number, dur: number, type: OscillatorType, gain: number): void {
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(gain, start + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(g).connect(out);
  osc.start(start);
  osc.stop(start + dur + 0.05);
}

const NOTE = (semitonesFromA4: number) => 440 * 2 ** (semitonesFromA4 / 12);

export function playSound(name: SoundName): void {
  if (!enabled) return;
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + 0.02;
  const master = ac.createGain();
  master.gain.value = 0.35;
  // Sanfter Tiefpass – klingt nach Soundkarte statt nach Sinusgenerator.
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 3200;
  master.connect(lp).connect(ac.destination);

  switch (name) {
    case 'start': {
      // Aufsteigender Dur-Akkord mit schwebendem Oberton: das „Hochfahren".
      const notes = [-9, -5, -2, 3, 7]; // C4 E4 G4 C5 E5 (relativ zu A4)
      notes.forEach((n, i) => {
        tone(ac, master, NOTE(n), t + i * 0.11, 2.2 - i * 0.15, 'triangle', 0.22);
        tone(ac, master, NOTE(n) * 2.003, t + i * 0.11 + 0.02, 1.4, 'sine', 0.05);
      });
      break;
    }
    case 'ding': {
      // Glöckchen für Hinweise
      tone(ac, master, NOTE(15), t, 0.6, 'sine', 0.3);
      tone(ac, master, NOTE(27), t, 0.35, 'sine', 0.08);
      break;
    }
    case 'chord': {
      // Dumpfer Zweiklang für Fehler
      tone(ac, master, NOTE(-12), t, 0.45, 'square', 0.12);
      tone(ac, master, NOTE(-5), t, 0.45, 'square', 0.09);
      break;
    }
    case 'fanfare': {
      // Kleine Fanfare für Beförderungen und die Krone
      const seq: [number, number, number][] = [
        [-2, 0, 0.16],
        [3, 0.16, 0.16],
        [7, 0.32, 0.16],
        [10, 0.48, 0.7],
      ];
      for (const [n, at, d] of seq) {
        tone(ac, master, NOTE(n), t + at, d + 0.2, 'sawtooth', 0.09);
        tone(ac, master, NOTE(n - 12), t + at, d + 0.2, 'triangle', 0.12);
      }
      break;
    }
  }
}
