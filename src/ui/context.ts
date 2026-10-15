import { createContext, useContext } from 'react';
import type { GameState, Player } from '../engine';

export interface GameCtx {
  state: GameState;
  me: Player;
  /** Führt eine reine Aktion aus. Fehler (ActionError) erscheinen als Alert-Box. */
  act: (fn: (s: GameState) => GameState) => boolean;
  /** Ist der Spieler gerade handlungsfähig? */
  canAct: boolean;
}

export const GameContext = createContext<GameCtx | null>(null);

export function useGame(): GameCtx {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('GameContext fehlt');
  return ctx;
}
