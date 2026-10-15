// Ausgaben-/Einnahmen-Diagnose je Archetyp: SIM_ECON=30 npm run sim:econ
import { it } from 'vitest';
import { newGame, planAiTurn, resolveYear, UNITS, militaryUpkeep, type Archetype } from '../src/engine';

const ARCHS: Archetype[] = ['pfeffersack', 'kriegstreiber', 'raenkeschmiedin', 'kirchenfuerst'];
const num = (t: string) => [...t.matchAll(/([\d.]+) (?:Taler|ha)/g)].map((m) => Number(m[1].replace(/\./g, '')));

it.runIf(process.env.SIM_ECON)('Ausgaben-Report je Archetyp', () => {
  const SEEDS = Number(process.env.SIM_ECON) || 30;
  const z = () => ({ income: 0, guard: 0, army: 0, guards: 0, years: 0, spy: 0, rob: 0, sabotage: 0, assassinate: 0, missions: 0, loot: 0, robbedLoss: 0, attacksIn: 0, landLost: 0, landWon: 0, cbHeld: 0, cbAgainst: 0, cbUsedAgainst: 0 });
  const st: Record<string, ReturnType<typeof z>> = Object.fromEntries(ARCHS.map((a) => [a, z()]));
  for (let seed = 1; seed <= SEEDS; seed++) {
    let s = newGame({ seed, endYear: 1820, players: ARCHS.map((a) => ({ name: a, isAI: true, archetype: a })) });
    while (s.phase === 'orders') {
      for (const p of s.players) s = planAiTurn(s, p.id);
      for (const p of s.players) {
        const r = st[p.name];
        r.guard += p.military.guards * UNITS.guards.upkeep;
        r.army += militaryUpkeep(p) - p.military.guards * UNITS.guards.upkeep;
        r.guards += p.military.guards; r.years++;
        r.cbHeld += p.casusBelli.length;
        for (const o of s.players) if (o.casusBelli.includes(p.id)) r.cbAgainst++;
      }
      for (const a of s.queue) {
        const from = s.players.find((p) => p.id === a.from)!.name;
        if (a.kind === 'covert') { st[from][a.mission] += a.gold; st[from].missions++; }
        if (a.kind === 'attack') {
          const t = s.players.find((p) => p.id === a.target)!;
          st[t.name].attacksIn++;
          if (s.players.find((p) => p.id === a.from)!.casusBelli.includes(t.id)) st[t.name].cbUsedAgainst++;
        }
      }
      const y = s.year;
      s = resolveYear(s);
      for (const p of s.players) {
        const r = st[p.name];
        if (p.lastReport) r.income += p.lastReport.taxIncome + p.lastReport.pilgrimIncome - p.lastReport.taxIntercepted;
        for (const m of (s.messages[p.id] ?? []).filter((m) => m.year === y)) {
          const n = num(m.text);
          if (m.title === 'Raubzug erfolgreich') r.loot += n[0] + (n[1] ?? 0);
          if (m.title === 'Raub!') r.robbedLoss += n[0] + (n[1] ?? 0);
          if (m.title === 'Überfall!' || m.title === 'Niederlage!') r.landLost += n[0];
          if (m.title === 'Sieg auf dem Schlachtfeld!' || m.title === 'Angriff abgewehrt!') r.landWon += n[0];
        }
      }
      s.messages = {};
    }
  }
  const pg = (v: number) => Math.round(v / SEEDS).toLocaleString('de-DE');
  console.log(`\nØ je Partie (${SEEDS} Seeds)`);
  console.log('Archetyp         Einkommen  Garde-Sold (Anteil)  Heer-Sold  Ø Garde | Taverne: Ausgaben  Beute  ROI  Missionen | beraubt | Angriffe erlitten  Land verloren  Land gewonnen | CB gehalten  CB gegen ihn  davon genutzt');
  for (const a of ARCHS) {
    const r = st[a];
    const spend = r.spy + r.rob + r.sabotage + r.assassinate;
    console.log(
      `${a.padEnd(16)} ${pg(r.income).padStart(9)}  ${pg(r.guard).padStart(8)} (${(100 * r.guard / r.income).toFixed(1)} %)  ${pg(r.army).padStart(9)}  ${Math.round(r.guards / r.years).toString().padStart(6)} | ${pg(spend).padStart(16)}  ${pg(r.loot).padStart(6)}  ${spend ? (r.loot / spend).toFixed(2) : '–'}x  ${(r.missions / SEEDS).toFixed(1).padStart(4)} | ${pg(r.robbedLoss).padStart(7)} | ${(r.attacksIn / SEEDS).toFixed(1).padStart(17)}  ${pg(r.landLost).padStart(13)}  ${pg(r.landWon).padStart(13)} | ${(r.cbHeld / SEEDS).toFixed(1).padStart(11)}  ${(r.cbAgainst / SEEDS).toFixed(1).padStart(12)}  ${(r.cbUsedAgainst / SEEDS).toFixed(1).padStart(13)}`,
    );
    if (a === 'raenkeschmiedin') console.log(`   Taverne-Ausgaben nach Mission: Ausspähen ${pg(r.spy)} · Raub ${pg(r.rob)} · Sabotage ${pg(r.sabotage)} · Attentat ${pg(r.assassinate)}`);
  }
});
