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
    const diplo = { treaties: 0, breaches: 0, ktBreaches: 0, rsBreaches: 0, allianceBattles: 0 };
    for (let seed = 1; seed <= seeds; seed++) {
      const s = runAiGame(seed, 120);
      years += s.year - 1700;
      diplo.treaties += s.chronicle.filter((c) => / schließen /.test(c.text)).length;
      diplo.breaches += s.chronicle.filter((c) => c.text.startsWith('Wortbruch')).length;
      diplo.ktBreaches += s.chronicle.filter((c) => c.text.startsWith(`Wortbruch: ${s.players[1].name}`)).length;
      diplo.rsBreaches += s.chronicle.filter((c) => c.text.startsWith(`Wortbruch: ${s.players[2].name}`)).length;
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
      `  Diplomatie je Partie: ${(diplo.treaties / seeds).toFixed(1)} Verträge, ${(diplo.breaches / seeds).toFixed(2)} Wortbrüche (Kriegstreiber ${(diplo.ktBreaches / seeds).toFixed(2)}, Ränkeschmiedin ${(diplo.rsBreaches / seeds).toFixed(2)}), ${(diplo.allianceBattles / seeds).toFixed(2)} Schlachten mit Bündnistruppen`,
    );
  });

  it.runIf(process.env.SIM_REPORT)('Balancing-Report', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const s = runAiGame(seed, 120);
      const battles = s.chronicle.filter((c) => /besiegt|schlägt den Angriff/.test(c.text)).length;
      const intrigues = s.chronicle.filter((c) => /Spion|Attentat|Anschlag/.test(c.text)).length;
      console.log(`\nSeed ${seed}: ${s.endReason} (Jahr ${s.year}) Schlachten=${battles} Intrigen-Skandale=${intrigues}`);
      for (const p of s.players) {
        const promos = s.chronicle.filter((c) => c.text.startsWith(p.name + ' wurde zu')).map((c) => `${c.year}`).join(',');
        console.log(
          `  ${p.name.padEnd(12)} ${TITLES[p.title].padEnd(9)} land=${p.land} pop=${p.population} gold=${Math.round(p.gold)} sav=${p.savings} debt=${Math.round(totalDebt(p))} b=${JSON.stringify(p.buildings)} kn=${p.military.knights} merc=${p.military.mercenaries} promos=${promos}`,
        );
      }
    }
  });
});

// Robustheit über verschiedene Aufstellungen: SIM_SETUPS=60 npx vitest run tests/simulation.test.ts -t Aufstellungen
describe('Aufstellungen', () => {
  it.runIf(process.env.SIM_SETUPS)('verschiedene Spielerzahlen und Mischungen', () => {
    const seeds = Number(process.env.SIM_SETUPS) || 30;
    type A = 'pfeffersack' | 'kriegstreiber' | 'raenkeschmiedin' | 'kirchenfuerst';
    const P: A = 'pfeffersack', K: A = 'kriegstreiber', R: A = 'raenkeschmiedin', C: A = 'kirchenfuerst';
    const short: Record<A, string> = { pfeffersack: 'Pf', kriegstreiber: 'Kr', raenkeschmiedin: 'Rä', kirchenfuerst: 'Ki' };
    const setups: { name: string; seats: A[] }[] = [
      { name: '1 Spieler (Pf)', seats: [P] },
      { name: '2: Pf+Kr', seats: [P, K] },
      { name: '2: Pf+Rä', seats: [P, R] },
      { name: '2: Pf+Ki', seats: [P, C] },
      { name: '2: Kr+Rä', seats: [K, R] },
      { name: '2: Kr+Ki', seats: [K, C] },
      { name: '2: Rä+Ki', seats: [R, C] },
      { name: '3: ohne Pf', seats: [K, R, C] },
      { name: '3: ohne Kr', seats: [P, R, C] },
      { name: '4: Standard', seats: [P, K, R, C] },
      { name: '4: 4× Kr', seats: [K, K, K, K] },
      { name: '4: 4× Pf', seats: [P, P, P, P] },
      { name: '6: je 1–2', seats: [P, K, R, C, P, K] },
      { name: '9: je 2–3', seats: [P, K, R, C, P, K, R, C, P] },
    ];
    console.log(`\n${seeds} Seeds je Aufstellung; Sitzordnung rotiert mit dem Seed. Siegquote je Sitz relativ zum Erwartungswert (1,00 = fair).`);
    console.log('Aufstellung       Ø Jahre  Kaiser  Zeitende  Reichstage  Wortbr.  Schuldturm | Siegquote je Archetyp');
    for (const setup of setups) {
      const wins: Record<string, number> = {};
      const seatsOf: Record<string, number> = {};
      let years = 0, kaiser = 0, timeout = 0, elections = 0, breaches = 0, prison = 0;
      for (let seed = 1; seed <= seeds; seed++) {
        const rot = seed % setup.seats.length;
        const seats = [...setup.seats.slice(rot), ...setup.seats.slice(0, rot)];
        let s = newGame({ seed, endYear: 1820, players: seats.map((a, i) => ({ name: `${short[a]}${i + 1}`, isAI: true, archetype: a })) });
        while (s.phase === 'orders') {
          for (const p of s.players) s = planAiTurn(s, p.id);
          for (const p of s.players) if (p.debtorPrison > 0) prison++;
          s = resolveYear(s);
        }
        years += s.year - 1700;
        const w = s.players.find((p) => p.id === s.winnerId)!;
        if (w.title === 8) kaiser++;
        else timeout++;
        elections += s.chronicle.filter((c) => c.text.startsWith('Der Reichstag wird einberufen')).length;
        breaches += s.chronicle.filter((c) => c.text.startsWith('Wortbruch')).length;
        wins[w.archetype!] = (wins[w.archetype!] ?? 0) + 1;
        for (const a of seats) seatsOf[a] = (seatsOf[a] ?? 0) + 1;
      }
      const quota = (Object.keys(seatsOf) as A[])
        .map((a) => `${short[a]} ${(((wins[a] ?? 0) / seeds) / (seatsOf[a] / seeds / setup.seats.length)).toFixed(2)}`)
        .join('  ');
      console.log(
        `${setup.name.padEnd(17)} ${(years / seeds).toFixed(0).padStart(7)} ${((100 * kaiser) / seeds).toFixed(0).padStart(6)} % ${((100 * timeout) / seeds).toFixed(0).padStart(6)} % ${(elections / seeds).toFixed(1).padStart(10)} ${(breaches / seeds).toFixed(2).padStart(8)} ${(prison / seeds).toFixed(1).padStart(10)}  | ${quota}`,
      );
    }
  });
});
