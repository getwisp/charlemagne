import { useGame } from '../context';

export function ChronicleWindow() {
  const { state } = useGame();
  const entries = [...state.chronicle].reverse();
  return (
    <div className="sunken field scroll-area" style={{ maxHeight: 360 }}>
      {entries.length === 0 && <div className="muted">Noch ist nichts Denkwürdiges geschehen.</div>}
      {entries.map((c, i) => (
        <div key={i} style={{ marginBottom: 3 }}>
          <b>Anno {c.year}:</b> {c.text}
        </div>
      ))}
    </div>
  );
}
