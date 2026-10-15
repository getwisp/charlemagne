import type { GameState, HeraldMessage, Player, Severity } from './types';

export class ActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ActionError';
  }
}

export function clone<T>(value: T): T {
  return structuredClone(value);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function nextId(s: GameState, prefix: string): string {
  s.idCounter += 1;
  return `${prefix}${s.idCounter}`;
}

export function getPlayer(s: GameState, id: string): Player {
  const p = s.players.find((pl) => pl.id === id);
  if (!p) throw new ActionError(`Unbekannter Spieler: ${id}`);
  return p;
}

export function tell(s: GameState, playerId: string, title: string, text: string, severity: Severity = 'info'): void {
  const msg: HeraldMessage = { id: nextId(s, 'm'), year: s.year, title, text, severity };
  (s.messages[playerId] ??= []).push(msg);
}

export function chronicle(s: GameState, text: string): void {
  s.chronicle.push({ year: s.year, text });
  if (s.chronicle.length > 300) s.chronicle.splice(0, s.chronicle.length - 300);
}

export function fmt(n: number): string {
  return Math.round(n).toLocaleString('de-DE');
}
