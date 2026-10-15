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

// Einnahmen-Aufschlüsselung je Archetyp: SIM_INCOME=30 npm run sim:econ
it.runIf(process.env.SIM_INCOME)('Einnahmen-Aufschlüsselung je Archetyp', async () => {
  const { mut, calculateTaxes, pilgrimIncome, cityCount, grainSellValue, grainBuyCost, BUILDINGS } = await import('../src/engine');
  const SEEDS = Number(process.env.SIM_INCOME) || 30;
  const keys = ['incomeTax', 'salesTax', 'tolls', 'cityBonus', 'crimeLoss', 'pilgrims', 'grainSold', 'grainBought', 'landBought', 'landSold', 'buildings', 'plunder', 'interest', 'pop', 'land', 'market', 'mill', 'cities', 'taxRate', 'years'] as const;
  type K = (typeof keys)[number];
  const st: Record<string, Record<K, number>> = Object.fromEntries(ARCHS.map((a) => [a, Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>]));
  let current: { players: { id: string; name: string }[] } | null = null;
  const nameOf = (id: string) => current!.players.find((p) => p.id === id)!.name;
  // Aktionen der KI mitschneiden (gleiche Funktionen, nur gezählt)
  const orig = { sellGrain: mut.sellGrain, buyGrain: mut.buyGrain, buyLand: mut.buyLand, sellLand: mut.sellLand, build: mut.build };
  mut.sellGrain = (s, pid, n) => { const v = grainSellValue(s, n); orig.sellGrain(s, pid, n); st[nameOf(pid)].grainSold += v; };
  mut.buyGrain = (s, pid, n) => { const v = grainBuyCost(s, n); orig.buyGrain(s, pid, n); st[nameOf(pid)].grainBought += v; };
  mut.buyLand = (s, pid, n) => { orig.buyLand(s, pid, n); st[nameOf(pid)].landBought += Math.floor(n) * s.market.landPrice; };
  mut.sellLand = (s, pid, n) => { orig.sellLand(s, pid, n); st[nameOf(pid)].landSold += Math.floor(n); };
  mut.build = (s, pid, t, c = 1) => { orig.build(s, pid, t, c); st[nameOf(pid)].buildings += BUILDINGS[t].cost * c; };
  try {
    for (let seed = 1; seed <= SEEDS; seed++) {
      let s = newGame({ seed, endYear: 1820, players: ARCHS.map((a) => ({ name: a, isAI: true, archetype: a })) });
      while (s.phase === 'orders') {
        current = s;
        for (const p of s.players) { s = planAiTurn(s, p.id); current = s; }
        for (const p of s.players) {
          const t = calculateTaxes(p);
          const r = st[p.name];
          r.incomeTax += t.incomeTax; r.salesTax += t.salesTax; r.tolls += t.tolls; r.cityBonus += t.cityBonus; r.crimeLoss += t.crimeLoss;
          r.pilgrims += pilgrimIncome(p); r.taxRate += p.taxes.income; r.years++;
        }
        const y = s.year;
        s = resolveYear(s);
        for (const p of s.players) {
          const r = st[p.name];
          if (p.lastReport) r.interest += p.lastReport.savingsInterest;
          for (const m of (s.messages[p.id] ?? []).filter((m) => m.year === y)) {
            const n = num(m.text);
            if (m.title === 'Sieg auf dem Schlachtfeld!' || m.title === 'Angriff abgewehrt!') r.plunder += n[1] ?? 0;
          }
        }
        s.messages = {};
      }
      for (const p of s.players) {
        const r = st[p.name];
        r.pop += p.population; r.land += p.land; r.market += p.buildings.market; r.mill += p.buildings.mill; r.cities += cityCount(p.buildings);
      }
    }
  } finally {
    Object.assign(mut, orig);
  }
  const pg = (v: number) => Math.round(v / SEEDS).toLocaleString('de-DE');
  console.log(`\nØ je Partie (${SEEDS} Seeds) – Steuern brutto nach Art, Kriminalität als Abzug`);
  console.log('Archetyp          Einkommenst.  MwSt.     Zölle    Stadtbonus  Kriminal.  Pilger | Korn verk.  Korn gek.  Land gekauft  Bauten   Beute   Zinsen | Ende: Bürger  Land    Märkte Mühlen Städte  Ø Eink.-Satz');
  for (const a of ARCHS) {
    const r = st[a];
    console.log(
      `${a.padEnd(16)} ${pg(r.incomeTax).padStart(12)} ${pg(r.salesTax).padStart(9)} ${pg(r.tolls).padStart(8)} ${pg(r.cityBonus).padStart(10)} ${('-' + pg(r.crimeLoss)).padStart(10)} ${pg(r.pilgrims).padStart(7)} | ${pg(r.grainSold).padStart(10)} ${pg(r.grainBought).padStart(10)} ${pg(r.landBought).padStart(12)} ${pg(r.buildings).padStart(8)} ${pg(r.plunder).padStart(7)} ${pg(r.interest).padStart(7)} | ${pg(r.pop).padStart(11)} ${pg(r.land).padStart(7)} ${(r.market / SEEDS).toFixed(1).padStart(6)} ${(r.mill / SEEDS).toFixed(1).padStart(6)} ${(r.cities / SEEDS).toFixed(1).padStart(6)}  ${(r.taxRate / r.years).toFixed(1).padStart(5)} %`,
    );
  }
});
