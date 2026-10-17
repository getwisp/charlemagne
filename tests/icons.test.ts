import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ICONS, PALETTE_CHARS } from '../src/ui/icons';

describe('Pixel-Symbole', () => {
  it.each(Object.entries(ICONS))('%s ist ein 16×16-Raster aus Palettenfarben', (_name, rows) => {
    expect(rows).toHaveLength(16);
    for (const row of rows) {
      expect(row).toHaveLength(16);
      for (const ch of row) expect(['.', ...PALETTE_CHARS]).toContain(ch);
    }
  });

  // Übersicht zum Begutachten: ICON_SHEET=/pfad/sheet.html npx vitest run tests/icons.test.ts
  it.runIf(process.env.ICON_SHEET)('Übersicht rendern', () => {
    const pal: Record<string, string> = { k: '#000', w: '#fff', g: '#c0c0c0', d: '#808080', r: '#f00', m: '#800000', y: '#ff0', o: '#808000', l: '#0f0', G: '#008000', c: '#0ff', t: '#008080', b: '#00f', n: '#000080', p: '#f0f', u: '#800080' };
    const svg = (rows: string[], size: number) =>
      `<svg width="${size}" height="${size}" viewBox="0 0 16 16" shape-rendering="crispEdges">${rows
        .flatMap((row, y) => [...row].map((ch, x) => (ch === '.' ? '' : `<rect x="${x}" y="${y}" width="1" height="1" fill="${pal[ch]}"/>`)))
        .join('')}</svg>`;
    const cells = Object.entries(ICONS)
      .map(([name, rows]) => `<div class="c">${svg(rows, 64)}${svg(rows, 32)}${svg(rows, 16)}<div>${name}</div></div>`)
      .join('');
    writeFileSync(process.env.ICON_SHEET!, `<!doctype html><style>body{background:#008080;margin:8px;font:12px sans-serif;color:#fff}.c{display:inline-block;width:150px;margin:6px;text-align:center;vertical-align:top}.c svg{margin:2px;vertical-align:bottom}.c:nth-child(odd){background:#c0c0c0;color:#000}</style>${cells}`);
  });
});
