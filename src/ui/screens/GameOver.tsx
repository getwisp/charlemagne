import { rankPlayers, score, TITLES, type GameState } from '../../engine';
import { GroupBox, n } from '../components/controls';
import { Modal } from '../components/Window';
import { clearAutosave, downloadSave } from '../storage';
import { PixelIcon } from '../icons';

export function GameOver({ state, onNewGame }: { state: GameState; onNewGame: () => void }) {
  const ranking = rankPlayers(state);
  const winner = state.players.find((p) => p.id === state.winnerId);
  return (
    <Modal title="Spielende" icon="throne" width={560} opaque>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <PixelIcon name={winner?.title === 8 ? 'throne' : 'scroll'} size={48} />
        <div>
          <div style={{ fontSize: 15, fontWeight: 'bold' }}>{winner ? `${winner.name} triumphiert!` : 'Das Spiel ist vorbei.'}</div>
          <div className="hint">{state.endReason}</div>
        </div>
      </div>
      <GroupBox label="Rangliste">
        <div className="table-wrap sunken">
          <table className="grid">
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Titel</th>
                <th className="num">Land</th>
                <th className="num">Bevölkerung</th>
                <th className="num">Punkte</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((p, i) => (
                <tr key={p.id}>
                  <td>{i + 1}</td>
                  <td style={{ color: p.color, fontWeight: 'bold' }}>
                    {p.name} {p.isAI ? '(KI)' : ''}
                  </td>
                  <td>{TITLES[p.title]}</td>
                  <td className="num">{n(p.land)}</td>
                  <td className="num">{n(p.population)}</td>
                  <td className="num">{n(score(p))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GroupBox>
      <GroupBox label="Chronik (Auszug)">
        <div className="sunken field scroll-area" style={{ maxHeight: 140 }}>
          {state.chronicle.slice(-15).map((c, i) => (
            <div key={i}>
              <b>{c.year}</b>: {c.text}
            </div>
          ))}
        </div>
      </GroupBox>
      <div className="btn-row">
        <button className="btn" onClick={() => downloadSave(state)}>
          Speichern…
        </button>
        <button
          className="btn primary"
          onClick={() => {
            clearAutosave();
            onNewGame();
          }}
        >
          Neues Spiel
        </button>
      </div>
    </Modal>
  );
}
