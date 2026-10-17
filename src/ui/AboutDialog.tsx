import { Modal } from './components/Window';
import { PixelIcon } from './icons';

/** „Über Karl 98": Info-Fenster im Stil der Windows-Programminfo. */
export function AboutDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Über Karl 98" icon="castle" width={400} onClose={onClose}>
      <div className="alert-body" style={{ alignItems: 'center' }}>
        <PixelIcon name="castle" size={48} />
        <div>
          <div style={{ fontSize: 16, fontWeight: 'bold' }}>Karl 98</div>
          <div>Wirtschaftssimulation im Heiligen Römischen Reich</div>
        </div>
      </div>
      <hr className="etched" />
      <div style={{ padding: '0 12px', lineHeight: 1.45 }}>
        <p style={{ margin: '4px 0' }}>
          Zu Ehren von <b>Carolus Magnus</b> – Karl dem Großen (um 747–814), König der Franken und seit Weihnachten 800 Kaiser. In Aachen errichtete er seine
          Pfalz und die Marienkirche, in der er begraben liegt. Auf seinem Thron im Aachener Dom wurden von 936 bis 1531 rund dreißig römisch-deutsche
          Könige gekrönt.
        </p>
        <p className="hint" style={{ margin: '8px 0 4px' }}>
          Schrift: WIN95FA von Alina Sava (SIL Open Font License 1.1). Alle Symbole sind eigene Pixelgrafiken, alle Klänge werden im Browser erzeugt.
        </p>
      </div>
      <div className="btn-row">
        <button className="btn primary" autoFocus onClick={onClose}>
          OK
        </button>
      </div>
    </Modal>
  );
}
