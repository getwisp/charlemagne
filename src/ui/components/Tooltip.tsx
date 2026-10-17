import { useEffect, useState } from 'react';

const DELAY_MS = 500;

/**
 * Win95-Tooltips: Übernimmt alle `title`-Attribute der Seite und zeigt sie als
 * hellgelbe Kästchen mit schwarzem Rand statt der modernen Browser-Tooltips.
 */
export function TooltipLayer() {
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null);

  useEffect(() => {
    let timer: number | undefined;
    let current: Element | null = null;
    let mouse = { x: 0, y: 0 };

    const hide = () => {
      window.clearTimeout(timer);
      current = null;
      setTip(null);
    };

    const onOver = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest?.('[title], [data-w95-title]') ?? null;
      if (el === current) return;
      hide();
      if (!el) return;
      // Den nativen Tooltip unterdrücken, Text merken
      const native = el.getAttribute('title');
      if (native !== null) {
        el.setAttribute('data-w95-title', native);
        el.removeAttribute('title');
      }
      const text = el.getAttribute('data-w95-title');
      if (!text) return;
      current = el;
      timer = window.setTimeout(() => {
        const x = Math.min(mouse.x + 12, window.innerWidth - 330);
        const y = Math.min(mouse.y + 20, window.innerHeight - 60);
        setTip({ text, x: Math.max(4, x), y });
      }, DELAY_MS);
    };
    const onMove = (e: MouseEvent) => {
      mouse = { x: e.clientX, y: e.clientY };
    };

    document.addEventListener('mouseover', onOver);
    document.addEventListener('mousemove', onMove, { passive: true });
    document.addEventListener('mousedown', hide);
    document.addEventListener('keydown', hide);
    window.addEventListener('blur', hide);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('mouseover', onOver);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mousedown', hide);
      document.removeEventListener('keydown', hide);
      window.removeEventListener('blur', hide);
    };
  }, []);

  if (!tip) return null;
  return (
    <div className="w95-tooltip" role="tooltip" style={{ left: tip.x, top: tip.y }}>
      {tip.text}
    </div>
  );
}
