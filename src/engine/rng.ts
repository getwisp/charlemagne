// Deterministischer Zufallsgenerator (mulberry32). Der Zustand liegt im
// GameState, damit ein Spielstand reproduzierbar bleibt.

export interface HasRng {
  rng: number;
}

export function random(s: HasRng): number {
  s.rng = (s.rng + 0x6d2b79f5) | 0;
  let t = s.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randFloat(s: HasRng, min: number, max: number): number {
  return min + random(s) * (max - min);
}

export function randInt(s: HasRng, min: number, max: number): number {
  return Math.floor(randFloat(s, min, max + 1));
}

export function chance(s: HasRng, p: number): boolean {
  return random(s) < p;
}

export function pick<T>(s: HasRng, items: readonly T[]): T {
  return items[Math.floor(random(s) * items.length)];
}

export function weightedIndex(s: HasRng, weights: readonly number[]): number {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = random(s) * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r < 0) return i;
  }
  return weights.length - 1;
}

export function shuffle<T>(s: HasRng, items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random(s) * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}
