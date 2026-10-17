import { TITLES, type GameState, type Player } from '../../engine';
import { Modal } from '../components/Window';
import { PixelIcon } from '../icons';

/** Hot-Seat: Bildschirm zur Übergabe, damit niemand fremde Werte sieht. */
export function Handover({ state, player, onReady }: { state: GameState; player: Player; onReady: () => void }) {
  const unread = state.messages[player.id]?.length ?? 0;
  return (
    <Modal title="Willkommen bei Karl 98" icon="key" width={400} opaque>
      <div style={{ display: 'flex', gap: 14, padding: '6px 4px' }}>
        <PixelIcon name="key" size={48} />
        <div>
          <p style={{ marginTop: 0 }}>
            Anno <b>{state.year}</b>. Bitte übergebt den Rechner an:
          </p>
          <p style={{ fontSize: 15, fontWeight: 'bold', color: player.color }}>
            {TITLES[player.title]} {player.name}
          </p>
          <p className="hint">Andere Spieler sollten jetzt wegsehen. {unread > 0 && `Der Herold hat ${unread} Meldung(en) für Euch.`}</p>
        </div>
      </div>
      <div className="btn-row">
        <button className="btn primary" onClick={onReady} autoFocus>
          OK
        </button>
      </div>
    </Modal>
  );
}
