// Win95-Zoom: Beim Minimieren und Wiederherstellen fliegt ein Rahmen zwischen
// Fenster und Taskleistenknopf. Rein dekorativ – ohne Web Animations API oder
// mit „weniger Bewegung" passiert einfach nichts.

const DURATION = 180;

function rectOf(selector: string): DOMRect | null {
  const el = document.querySelector(selector);
  return el ? el.getBoundingClientRect() : null;
}

function reducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function zoomRect(from: DOMRect | null, to: DOMRect | null): void {
  if (!from || !to || reducedMotion()) return;
  const box = document.createElement('div');
  box.className = 'zoom-rect';
  document.body.appendChild(box);
  const frame = (r: DOMRect) => ({ left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
  if (typeof box.animate !== 'function') {
    box.remove();
    return;
  }
  const anim = box.animate([frame(from), frame(to)], { duration: DURATION, easing: 'linear' });
  anim.onfinish = () => box.remove();
  anim.oncancel = () => box.remove();
}

export const winSelector = (id: string) => `[data-win="${id}"]`;
export const taskSelector = (id: string) => `[data-task="${id}"]`;

/** Fenster → Taskleiste (vor dem Ausblenden aufrufen, solange das Fenster noch sichtbar ist). */
export function zoomToTask(id: string): void {
  zoomRect(rectOf(winSelector(id)), rectOf(taskSelector(id)));
}

/** Taskleiste → Fenster (nach dem Einblenden aufrufen). */
export function zoomFromTask(id: string): void {
  requestAnimationFrame(() => zoomRect(rectOf(taskSelector(id)), rectOf(winSelector(id))));
}
