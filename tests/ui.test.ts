import { describe, expect, it } from 'vitest';
import { accelOf } from '../src/ui/components/Menu';

describe('Menü-Kürzel', () => {
  it('nimmt den Buchstaben nach „&", sonst den ersten Buchstaben', () => {
    expect(accelOf('Alle Fenster &minimieren')).toBe('m');
    expect(accelOf('Boss-&Taste (F2)')).toBe('t');
    expect(accelOf('Überlappend')).toBe('ü');
    expect(accelOf('Taverne „Zum goldenen Dolch“')).toBe('t');
  });
});
