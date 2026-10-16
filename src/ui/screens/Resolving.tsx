import { useEffect, useState } from 'react';
import { ARCHETYPES, planAiTurn, resolveYear, type GameState } from '../../engine';
import { Progress } from '../components/controls';
import { Modal } from '../components/Window';
import { PixelIcon } from '../icons';

/**
 * Rundenwechsel: KI-Züge werden mit künstlicher Bedenkzeit (0,8–1,5 s) berechnet,
 * danach löst die Engine Intrigen, Kriege und die Wirtschaft auf.
 */
export function Resolving({ state, onDone }: { state: GameState; onDone: (s: GameState) => void }) {
  const ais = state.players.filter((p) => p.isAI);
  const [step, setStep] = useState(0);
  const [stepStart, setStepStart] = useState(() => performance.now());
  const [stepDuration, setStepDuration] = useState(1000);
  const [now, setNow] = useState(() => performance.now());

  // Sanduhr-Mauszeiger, solange die Fürsten beraten
  useEffect(() => {
    document.body.classList.add('busy');
    const tick = setInterval(() => setNow(performance.now()), 80);
    return () => {
      document.body.classList.remove('busy');
      clearInterval(tick);
    };
  }, []);

  useEffect(() => {
    // planAiTurn/resolveYear sind rein – ein Neustart (StrictMode) ist harmlos.
    let s = state;
    let cancelled = false;
    const delay = () => state.settings.aiDelayMin + Math.random() * (state.settings.aiDelayMax - state.settings.aiDelayMin);
    (async () => {
      for (let i = 0; i < ais.length; i++) {
        const d = delay();
        setStep(i);
        setStepStart(performance.now());
        setStepDuration(d);
        await new Promise((r) => setTimeout(r, d));
        if (cancelled) return;
        s = planAiTurn(s, ais[i].id);
      }
      setStep(ais.length);
      setStepStart(performance.now());
      setStepDuration(600);
      await new Promise((r) => setTimeout(r, 600));
      if (cancelled) return;
      onDone(resolveYear(s));
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const total = ais.length + 1;
  // Innerhalb eines Schritts füllt sich der Balken Block für Block.
  const within = Math.min(1, Math.max(0, (now - stepStart) / stepDuration));
  const progress = (Math.min(step, ais.length) + within) / total;
  const current = step < ais.length ? ais[step] : null;
  return (
    <Modal title={`Die Fürsten beraten – Anno ${state.year}`} icon="hourglass" width={420} opaque>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 10 }}>
        <PixelIcon name={current ? 'hourglass' : 'market'} size={32} />
        <div>
          {current ? (
            <>
              <b>{current.name}</b> ({ARCHETYPES[current.archetype ?? 'pfeffersack'].name}) grübelt über seinen Zug…
            </>
          ) : (
            <>Der Reichskanzler wertet Intrigen, Schlachten und Ernten aus…</>
          )}
        </div>
      </div>
      <Progress value={progress} />
      <div className="hint" style={{ textAlign: 'right' }}>{Math.round(progress * 100)} % abgeschlossen</div>
      <ul className="hint" style={{ margin: '8px 0 0', paddingLeft: 18 }}>
        {ais.map((a, i) => (
          <li key={a.id}>
            {a.name}: {i < step ? 'fertig ✓' : i === step ? 'denkt nach…' : 'wartet'}
          </li>
        ))}
        <li>Rundenauflösung: {step >= ais.length ? 'läuft…' : 'wartet'}</li>
      </ul>
    </Modal>
  );
}
