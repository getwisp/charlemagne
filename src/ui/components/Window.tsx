import { useEffect, useRef, useState, type ReactNode } from 'react';

interface WindowProps {
  title: string;
  icon?: string;
  x: number;
  y: number;
  width?: number;
  z: number;
  active: boolean;
  onFocus: () => void;
  onClose: () => void;
  onMinimize?: () => void;
  onMove: (x: number, y: number) => void;
  children: ReactNode;
  statusText?: string;
}

/** Ein verschiebbares Fenster im Stil von Windows 95. */
export function Window({ title, icon, x, y, width = 420, z, active, onFocus, onClose, onMinimize, onMove, children, statusText }: WindowProps) {
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  function onPointerDown(e: React.PointerEvent) {
    if ((e.target as HTMLElement).closest('button')) return;
    onFocus();
    drag.current = { dx: e.clientX - x, dy: e.clientY - y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const parent = ref.current?.parentElement?.getBoundingClientRect();
    const maxX = (parent?.width ?? window.innerWidth) - 60;
    const maxY = (parent?.height ?? window.innerHeight) - 24;
    onMove(Math.max(-width + 80, Math.min(maxX, e.clientX - drag.current.dx)), Math.max(0, Math.min(maxY, e.clientY - drag.current.dy)));
  }
  function onPointerUp() {
    drag.current = null;
  }

  return (
    <div
      ref={ref}
      className={`window raised ${active ? 'active' : ''}`}
      style={{ left: x, top: y, width, zIndex: z }}
      onPointerDownCapture={onFocus}
      role="dialog"
      aria-label={title}
    >
      <div className="titlebar" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
        {icon && <span aria-hidden>{icon}</span>}
        <span className="title">{title}</span>
        {onMinimize && (
          <button className="btn tb-btn" onClick={onMinimize} aria-label="Minimieren">
            _
          </button>
        )}
        <button className="btn tb-btn" onClick={onClose} aria-label="Schließen">
          ✕
        </button>
      </div>
      <div className="window-body">{children}</div>
      {statusText !== undefined && (
        <div className="statusline">
          <div className="sunken">{statusText}</div>
        </div>
      )}
    </div>
  );
}

interface ModalProps {
  title: string;
  icon?: string;
  width?: number;
  children: ReactNode;
  onClose?: () => void;
  opaque?: boolean;
}

/** Modales Fenster in der Bildschirmmitte. */
export function Modal({ title, icon, width = 380, children, onClose, opaque }: ModalProps) {
  return (
    <div className={`overlay ${opaque ? 'opaque' : ''}`}>
      <div className="window raised modal-window" style={{ width }} role="alertdialog" aria-label={title}>
        <div className="titlebar">
          {icon && <span aria-hidden>{icon}</span>}
          <span className="title">{title}</span>
          {onClose && (
            <button className="btn tb-btn" onClick={onClose} aria-label="Schließen">
              ✕
            </button>
          )}
        </div>
        <div className="window-body">{children}</div>
      </div>
    </div>
  );
}

const SEVERITY_ICON = { info: 'ℹ️', good: '📜', warning: '⚠️', error: '⛔' } as const;

interface AlertProps {
  title: string;
  text: string;
  severity?: keyof typeof SEVERITY_ICON;
  onOk: () => void;
  extra?: ReactNode;
  counter?: string;
}

/** Klassische Windows-Alert-Box für Herold-Meldungen. */
export function Alert({ title, text, severity = 'info', onOk, extra, counter }: AlertProps) {
  const okRef = useRef<HTMLButtonElement>(null);
  useEffect(() => okRef.current?.focus(), [title, text]);
  return (
    <Modal title={title} width={440}>
      <div className="alert-body">
        <div className="alert-icon" aria-hidden>
          {SEVERITY_ICON[severity]}
        </div>
        <div className="alert-text">{text}</div>
      </div>
      <div className="btn-row" style={{ justifyContent: 'center' }}>
        {counter && <span className="muted" style={{ alignSelf: 'center', marginRight: 'auto' }}>{counter}</span>}
        <button ref={okRef} className="btn primary" onClick={onOk}>
          OK
        </button>
        {extra}
      </div>
    </Modal>
  );
}

export function useToggle(initial = false): [boolean, () => void] {
  const [v, set] = useState(initial);
  return [v, () => set((x) => !x)];
}
