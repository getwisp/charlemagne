import { useCallback, useEffect, useState } from 'react';
import { ActionError, newGame, type GameState, type PlayerSetup } from '../engine';
import { TooltipLayer } from './components/Tooltip';
import { Alert } from './components/Window';
import { GameContext } from './context';
import { Desktop } from './Desktop';
import { GameOver } from './screens/GameOver';
import { Handover } from './screens/Handover';
import { Resolving } from './screens/Resolving';
import { ScreensaverHost } from './Screensaver';
import { Setup } from './screens/Setup';
import { autosave } from './storage';

type Screen =
  | { kind: 'setup' }
  | { kind: 'handover'; playerId: string }
  | { kind: 'play'; playerId: string }
  | { kind: 'resolving' }
  | { kind: 'ended' };

function nextScreen(s: GameState): Screen {
  if (s.phase === 'ended') return { kind: 'ended' };
  const humans = s.players.filter((p) => !p.isAI);
  const pending = humans.filter((p) => !p.turnDone);
  if (pending.length === 0) return { kind: 'resolving' };
  if (humans.length === 1) return { kind: 'play', playerId: pending[0].id };
  return { kind: 'handover', playerId: pending[0].id };
}

export function App() {
  const [game, setGameRaw] = useState<GameState | null>(null);
  const [screen, setScreen] = useState<Screen>({ kind: 'setup' });
  /** Zustand zu Beginn des aktuellen Zuges – für „Zug zurücksetzen“. */
  const [snapshot, setSnapshot] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const setGame = useCallback((s: GameState) => {
    setGameRaw(s);
    autosave(s);
  }, []);

  const enter = useCallback(
    (s: GameState) => {
      setGame(s);
      const next = nextScreen(s);
      setScreen(next);
      if (next.kind === 'play') setSnapshot(s);
    },
    [setGame],
  );

  const startGame = (players: PlayerSetup[], endYear: number, seed?: number) => enter(newGame({ players, endYear, seed }));

  const act = useCallback(
    (fn: (s: GameState) => GameState): boolean => {
      if (!game) return false;
      try {
        setGame(fn(game));
        return true;
      } catch (e) {
        if (e instanceof ActionError) setError(e.message);
        else setError(`Unerwarteter Fehler: ${e instanceof Error ? e.message : String(e)}`);
        return false;
      }
    },
    [game, setGame],
  );

  // Fenstertitel zeigt das Jahr
  useEffect(() => {
    document.title = game ? `Karl 98 – Anno ${game.year}` : 'Karl 98';
  }, [game]);

  let content: React.ReactNode = null;
  if (screen.kind === 'setup' || !game) {
    content = <Setup onStart={startGame} onLoad={enter} />;
  } else if (screen.kind === 'handover') {
    const p = game.players.find((pl) => pl.id === screen.playerId)!;
    content = (
      <Handover
        state={game}
        player={p}
        onReady={() => {
          setSnapshot(game);
          setScreen({ kind: 'play', playerId: p.id });
        }}
      />
    );
  } else if (screen.kind === 'resolving') {
    content = <Resolving state={game} onDone={enter} />;
  } else if (screen.kind === 'ended') {
    content = <GameOver state={game} onNewGame={() => setScreen({ kind: 'setup' })} />;
  } else {
    const me = game.players.find((p) => p.id === screen.playerId)!;
    content = (
      <GameContext.Provider value={{ state: game, me, act, canAct: me.debtorPrison <= 0 && me.sickbed <= 0 && !me.turnDone }}>
        <Desktop
          onEndTurn={(s) => enter(s)}
          onReset={() => snapshot && setGame({ ...snapshot, messages: game.messages })}
          onLoad={enter}
          onQuit={() => setScreen({ kind: 'setup' })}
          setRaw={setGame}
        />
      </GameContext.Provider>
    );
  }

  return (
    <>
      {content}
      {error && <Alert title="Karl 98" text={error} severity="error" onOk={() => setError(null)} />}
      <TooltipLayer />
      <ScreensaverHost />
    </>
  );
}
