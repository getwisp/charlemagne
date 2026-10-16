import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { PixelIcon, type IconName } from '../icons';

export type MenuEntry = { label: string; icon?: IconName; onClick: () => void; disabled?: boolean; bold?: boolean } | 'sep';

/** Kontextmenü an der Mausposition, schließt bei Klick daneben oder Esc. */
export function ContextMenu({ x, y, items, onClose }: { x: number; y: number; items: MenuEntry[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });

  // Am Bildschirmrand nach innen klappen
  useLayoutEffect(() => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    setPos({ x: Math.max(0, Math.min(x, window.innerWidth - r.width - 2)), y: Math.max(0, Math.min(y, window.innerHeight - r.height - 2)) });
  }, [x, y]);

  useEffect(() => {
    const down = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('pointerdown', down, true);
    window.addEventListener('keydown', key);
    ref.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    return () => {
      window.removeEventListener('pointerdown', down, true);
      window.removeEventListener('keydown', key);
    };
  }, [onClose]);

  return (
    <div ref={ref} className="menu raised" role="menu" style={{ left: pos.x, top: pos.y }} onContextMenu={(e) => e.preventDefault()}>
      <MenuList items={items} onClose={onClose} />
    </div>
  );
}

export function MenuList({ items, onClose }: { items: MenuEntry[]; onClose: () => void }) {
  return (
    <ul onKeyDown={(e) => moveFocus(e)}>
      {items.map((it, i) =>
        it === 'sep' ? (
          <li key={i} className="sep" role="separator" />
        ) : (
          <li key={i} role="none">
            <button
              role="menuitem"
              disabled={it.disabled}
              style={it.bold ? { fontWeight: 'bold' } : undefined}
              onClick={() => {
                onClose();
                it.onClick();
              }}
            >
              <span className="menu-icon">{it.icon && <PixelIcon name={it.icon} />}</span>
              {it.label}
            </button>
          </li>
        ),
      )}
    </ul>
  );
}

/** Pfeiltasten wandern durch die Einträge eines Menüs. */
export function moveFocus(e: React.KeyboardEvent<HTMLElement>): void {
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
  e.preventDefault();
  const buttons = [...e.currentTarget.querySelectorAll<HTMLButtonElement>(':scope > li > button:not(:disabled)')];
  const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
  const next = e.key === 'ArrowDown' ? (i + 1) % buttons.length : (i - 1 + buttons.length) % buttons.length;
  buttons[next]?.focus();
}
