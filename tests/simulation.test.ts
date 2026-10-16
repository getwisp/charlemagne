import { describe, expect, it } from 'vitest';
import { allHumansDone, newGame, planAiTurn, resolveYear, TITLES, totalDebt, type GameState } from '../src/engine';

function runAiGame(seed: number, years: number): GameState {
  let s = newGame({
    seed,
    endYear: 1700 + years,
    players: [
      { name: 'Hanse', isAI: true, archetype: 'pfeffersack' },
      { name: 'Wallenstein', isAI: true, archetype: 'kriegstreiber' },
      { name: 'Medici', isAI: true, archetype: 'raenkeschmiedin' },
      { name: 'Bischof', isAI: true, archetype: 'kirchenfuerst' },
    ],
  });
  while (s.phase === 'orders') {
    for (const p of s.players) if (p.isAI) s = planAiTurn(s, p.id);
    expect(allHumansDone(s)).toBe(true);
    s = resolveYear(s);
  }
  return s;
}

describe('KI-Simulation', () => {
  it('spielt eine komplette Partie ohne Fehler und mit Fortschritt', () => {
    const s = runAiGame(42, 100);
    expect(s.phase).toBe('ended');
    expect(s.winnerId).not.toBeNull();
    for (const p of s.players) {
      expect(Number.isFinite(p.gold)).toBe(true);
      expect(p.population).toBeGreaterThanOrEqual(0);
    }
    expect(Math.max(...s.players.map((p) => p.title))).toBeGreaterThanOrEqual(3);
  });

  it('ist deterministisch bei gleichem Seed', () => {
    const a = runAiGame(7, 20);
    const b = runAiGame(7, 20);
    expect(JSON.stringify(a.players)).toBe(JSON.stringify(b.players));
  });

  it.runIf(process.env.SIM_SUMMARY)('Archetypen-Statistik über viele Seeds', () => {
    const seeds = Number(process.env.SIM_SUMMARY) || 30;
    const names = ['Pfeffersack', 'Kriegstreiber', 'Ränkeschmiedin', 'Kirchenfürst'];
    const wins = [0, 0, 0, 0];
    const titleSum = [0, 0, 0, 0];
    const emperor = [0, 0, 0, 0];
    let years = 0;
    const diplo = { treaties: 0, breaches: 0, allianceBattles: 0 };
    for (let seed = 1; seed <= seeds; seed++) {
      const s = runAiGame(seed, 120);
      years += s.year - 1700;
      diplo.treaties += s.chronicle.filter((c) => / schließen /.test(c.text)).length;
      diplo.breaches += s.chronicle.filter((c) => c.text.startsWith('Wortbruch')).length;
      diplo.allianceBattles += s.chronicle.filter((c) => c.text.includes('Bündnistruppen')).length;
      const w = s.players.findIndex((p) => p.id === s.winnerId);
      wins[w]++;
      if (s.players[w].title === 8) emperor[w]++;
      s.players.forEach((p, i) => (titleSum[i] += Math.min(p.title, 7)));
    }
    console.log(`\n${seeds} Partien, Ø Dauer ${(years / seeds).toFixed(0)} Jahre`);
    names.forEach((n, i) =>
      console.log(`  ${n.padEnd(15)} Siege ${String(wins[i]).padStart(2)} (Kaiser ${emperor[i]})  Ø Endtitel ${(titleSum[i] / seeds).toFixed(2)}`),
    );
    console.log(
      `  Diplomatie je Partie: ${(diplo.treaties / seeds).toFixed(1)} Verträge, ${(diplo.breaches / seeds).toFixed(2)} Wortbrüche, ${(diplo.allianceBattles / seeds).toFixed(2)} Schlachten mit Bündnistruppen`,
    );
  });

  it.runIf(process.env.SIM_REPORT)('Balancing-Report', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const s = runAiGame(seed, 120);
      const battles = s.chronicle.filter((c) => /besiegt|schlägt den Angriff/.test(c.text)).length;
      const intrigues = s.chronicle.filter((c) => /Spion|Attentat|Anschlag/.test(c.text)).length;
      console.log(`\nSeed ${seed}: ${s.endReason} (Jahr ${s.year}) Schlachten=${battles} Intrigen-Skandale=${intrigues}`);
      for (const p of s.players) {
        const promos = s.chronicle.filter((c) => c.text.startsWith(p.name + ' wurde zum')).map((c) => `${c.year}`).join(',');
        console.log(
          `  ${p.name.padEnd(12)} ${TITLES[p.title].padEnd(9)} land=${p.land} pop=${p.population} gold=${Math.round(p.gold)} sav=${p.savings} debt=${Math.round(totalDebt(p))} b=${JSON.stringify(p.buildings)} kn=${p.military.knights} merc=${p.military.mercenaries} promos=${promos}`,
        );
      }
    }
  });
});
