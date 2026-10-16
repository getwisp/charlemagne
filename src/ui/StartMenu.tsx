import { useEffect, useRef, useState } from 'react';
import { MenuList, moveFocus, type MenuEntry } from './components/Menu';
import { PixelIcon, type IconName } from './icons';

interface Folder {
  key: string;
  label: string;
  icon: IconName;
  items: MenuEntry[];
}

interface StartMenuProps {
  folders: Folder[];
  items: MenuEntry[];
  onClose: () => void;
}

/** Startmenü im Stil von Windows 98: Seitenleiste, Ordner mit ausklappenden Untermenüs. */
export function StartMenu({ folders, items, onClose }: StartMenuProps) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>('button')?.focus();
  }, []);

  function focusSub(key: string) {
    setOpenKey(key);
    requestAnimationFrame(() => ref.current?.querySelector<HTMLButtonElement>(`[data-sub="${key}"] button`)?.focus());
  }

  return (
    <div ref={ref} className="start-menu raised" role="menu" onPointerDown={(e) => e.stopPropagation()}>
      <div className="stripe">
        <b>Kaiser-Klon</b> 98
      </div>
      <ul onKeyDown={moveFocus}>
        {folders.map((f) => (
          <li key={f.key} role="none" className="folder" onMouseEnter={() => setOpenKey(f.key)}>
            <button
              role="menuitem"
              aria-haspopup="menu"
              aria-expanded={openKey === f.key}
              className={openKey === f.key ? 'open' : ''}
              onClick={() => (openKey === f.key ? setOpenKey(null) : focusSub(f.key))}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight') {
                  e.preventDefault();
                  focusSub(f.key);
                }
              }}
            >
              <PixelIcon name={f.icon} size={24} />
              <span style={{ flex: 1 }}>{f.label}</span>
              <span className="arrow">▶</span>
            </button>
            {openKey === f.key && (
              <div
                className="submenu raised"
                data-sub={f.key}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowLeft') {
                    e.stopPropagation();
                    setOpenKey(null);
                    ref.current?.querySelector<HTMLButtonElement>(`.folder button[aria-expanded="true"]`)?.focus();
                  }
                }}
              >
                <MenuList items={f.items} onClose={onClose} />
              </div>
            )}
          </li>
        ))}
        <li className="sep" role="separator" onMouseEnter={() => setOpenKey(null)} />
        {items.map((it, i) =>
          it === 'sep' ? (
            <li key={i} className="sep" role="separator" />
          ) : (
            <li key={i} role="none" onMouseEnter={() => setOpenKey(null)}>
              <button
                role="menuitem"
                onClick={() => {
                  onClose();
                  it.onClick();
                }}
              >
                {it.icon && <PixelIcon name={it.icon} size={24} />}
                {it.label}
              </button>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}
