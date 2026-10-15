import { SAVE_VERSION, type GameState } from '../engine';

const KEY = 'kaiser-klon/autosave';

export function autosave(state: GameState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ savedAt: Date.now(), state }));
  } catch {
    // Speicher voll oder blockiert – das Spiel läuft trotzdem weiter.
  }
}

export function loadAutosave(): { savedAt: number; state: GameState } | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isGameState(parsed?.state) ? parsed : null;
  } catch {
    return null;
  }
}

export function clearAutosave(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignorieren */
  }
}

export function isGameState(v: unknown): v is GameState {
  const s = v as GameState;
  return !!s && typeof s === 'object' && s.version === SAVE_VERSION && Array.isArray(s.players) && typeof s.year === 'number';
}

/** Spielstand als Datei herunterladen – für asynchrone Partien per E-Mail/Messenger. */
export function downloadSave(state: GameState): void {
  const blob = new Blob([JSON.stringify(state)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `kaiser-klon-anno-${state.year}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function pickSaveFile(): Promise<GameState> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return reject(new Error('Keine Datei gewählt.'));
      try {
        const parsed = JSON.parse(await file.text());
        if (!isGameState(parsed)) throw new Error('Ungültiger oder veralteter Spielstand.');
        resolve(parsed);
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    };
    input.click();
  });
}
