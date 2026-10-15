import { describe, expect, it } from 'vitest';
import {
  actions,
  ActionError,
  ARCHETYPES,
  calculateTaxes,
  cityBonusFactor,
  pilgrimIncome,
  tradeRetention,
  blockerBoost,
  intrigueTargetScores,
  knightGoal,
  effectiveWeights,
  resolveCovert,
  TITLE_BLOCKER_MULTIPLIER,
  BISHOP_MIN_SCORE,
  calculateEconomyTurn,
  canBePromoted,
  checkTitles,
  cityCount,
  covertChance,
  drawEvent,
  EVENT_CARDS,
  freeLand,
  freshEventBag,
  landlessKnights,
  mut,
  newGame,
  planAiTurn,
  resolveAttack,
  resolveElection,
  resolveInsolvency,
  resolveYear,
  T,
  type GameState,
} from '../src/engine';

function game(players = 2): GameState {
  return newGame({
    seed: 123,
    players: Array.from({ length: players }, (_, i) => ({ name: `P${i + 1}`, isAI: i > 0, archetype: 'pfeffersack' as const })),
  });
}

describe('Wirtschaft', () => {
  it('Stadt-Formel: 5 Märkte + 3 Mühlen = 1 Stadt (abgeleitet)', () => {
    expect(cityCount({ market: 5, mill: 3, granary: 0, palace: 0, cathedral: 0 })).toBe(1);
    expect(cityCount({ market: 9, mill: 3, granary: 0, palace: 0, cathedral: 0 })).toBe(1);
    expect(cityCount({ market: 10, mill: 6, granary: 0, palace: 0, cathedral: 0 })).toBe(2);
    expect(cityCount({ market: 4, mill: 30, granary: 0, palace: 0, cathedral: 0 })).toBe(0);
  });

  it('Stadt-Bonus: drei Städte voll (+10 %), jede weitere +5 %', () => {
    const b = (cities: number) => ({ market: 5 * cities, mill: 3 * cities, granary: 0, palace: 0, cathedral: 0 });
    expect(cityBonusFactor(b(1))).toBeCloseTo(0.1);
    expect(cityBonusFactor(b(3))).toBeCloseTo(0.3);
    expect(cityBonusFactor(b(5))).toBeCloseTo(0.4);
  });

  it('calculateEconomyTurn ist rein und reagiert auf die Ration', () => {
    const s = game();
    const p = s.players[0];
    const before = JSON.stringify(p);
    const full = calculateEconomyTurn({ ...p, ration: 100 }, s.market);
    const hungry = calculateEconomyTurn({ ...p, ration: 50 }, s.market);
    const generous = calculateEconomyTurn({ ...p, ration: 150 }, s.market);
    expect(JSON.stringify(p)).toBe(before);
    expect(hungry.starved).toBeGreaterThan(0);
    expect(full.starved).toBe(0);
    expect(generous.immigrants).toBeGreaterThan(full.immigrants);
    expect(generous.populationAfter).toBeGreaterThan(hungry.populationAfter);
  });

  it('sanfte Steuerkurve: keine Freizone, Handel weicht aus', () => {
    const s = game();
    const p = s.players[0];
    p.buildings.market = 8;
    // Referenzsatz unverändert, darüber schrumpft das Volumen stetig
    expect(tradeRetention(10)).toBe(1);
    expect(tradeRetention(12)).toBeLessThan(1);
    expect(tradeRetention(15)).toBeLessThan(tradeRetention(12));
    // Ertragsmaximum um 11 %: 20 % bringen weniger als 10 %
    const rev = (sales: number) => calculateTaxes({ ...p, taxes: { ...p.taxes, sales } }).salesTax;
    expect(rev(11)).toBeGreaterThan(rev(10));
    expect(rev(20)).toBeLessThan(rev(10));
    // Einkommensteuer: schon unterhalb der alten 25-%-Schwelle kostet jeder Punkt Einwohner
    const emi = (income: number) => calculateEconomyTurn({ ...p, taxes: { ...p.taxes, income } }, s.market).emigrants;
    expect(emi(22)).toBeGreaterThan(emi(18));
  });

  it('Pilger: je 1.000 Einwohner × Kirchenfaktor, fließen in den Haushalt', () => {
    const s = game();
    const p = s.players[0];
    p.population = 5000;
    p.justice = 3;
    expect(pilgrimIncome(p)).toBe(0); // ohne Kathedrale, Palast oder milde Justiz keine Pilger
    p.buildings.cathedral = 1;
    p.buildings.palace = 2;
    const gerecht = pilgrimIncome(p);
    expect(gerecht).toBe(Math.round(5 * 200 * 1.4));
    expect(pilgrimIncome({ ...p, justice: 1 })).toBeGreaterThan(gerecht);
    const preview = calculateEconomyTurn(p, s.market);
    expect(preview.pilgrimIncome).toBe(gerecht);
    expect(preview.netGold).toBe(preview.taxIncome + gerecht - preview.militaryUpkeep - preview.buildingUpkeep - preview.loanPayments - preview.landlessKnightPay);
  });

  it('Kornspeicher mindern den Rattenfraß', () => {
    const s = game();
    const p = { ...s.players[0], grain: 20000 };
    const none = calculateEconomyTurn(p, s.market, { ratRate: 0.2 });
    const three = calculateEconomyTurn({ ...p, buildings: { ...p.buildings, granary: 3 } }, s.market, { ratRate: 0.2 });
    expect(three.ratLoss).toBeLessThan(none.ratLoss);
  });

  it('Jedes Gebäude braucht 1.000 ha freies Land', () => {
    let s = game();
    const p = s.players[0];
    p.gold = 1e6;
    p.land = 1500;
    s = actions.build(s, p.id, 'market', 1);
    expect(s.players[0].buildings.market).toBe(1);
    expect(() => actions.build(s, p.id, 'market', 1)).toThrow(ActionError);
  });
});

describe('Bank & Insolvenz', () => {
  it('Stufe 1: Sparkonto wird gepfändet', () => {
    const s = game();
    const p = s.players[0];
    p.gold = -1000;
    p.savings = 5000;
    expect(resolveInsolvency(s, p)).toBe('seized');
    expect(p.gold).toBe(0);
    expect(p.savings).toBe(4000);
  });

  it('Stufe 2: Zwangsversteigerung zum halben Preis', () => {
    const s = game();
    const p = s.players[0];
    p.gold = -10000;
    const landBefore = p.land;
    expect(resolveInsolvency(s, p)).toBe('auctioned');
    expect(p.gold).toBeGreaterThanOrEqual(0);
    const sold = landBefore - p.land;
    expect(sold).toBeGreaterThanOrEqual(Math.floor(10000 / (s.market.landPrice / 2)));
  });

  it('Stufe 3: Schuldturm mit Rückstufung und Zwangskredit', () => {
    const s = game();
    const p = s.players[0];
    p.title = T.BARON;
    p.land = 1000;
    p.gold = -50000;
    expect(resolveInsolvency(s, p)).toBe('prison');
    expect(p.debtorPrison).toBe(1);
    expect(p.title).toBe(T.FREIHERR);
    expect(p.loans.some((l) => l.forced)).toBe(true);
  });

  it('Schuldturm: Spieler kann nicht handeln, Heer ist wehrlos', () => {
    let s = game();
    s.players[0].debtorPrison = 1;
    expect(() => actions.buyGrain(s, 'p1', 100)).toThrow(/Schuldturm/);
    s = actions.endTurn(s, 'p1');
    expect(s.players[0].turnDone).toBe(true);
  });

  it('Sparkonto ist zu 100 % vor dem Diebstahl-Ereignis sicher', () => {
    const s = game();
    const p = s.players[0];
    p.gold = 10000;
    p.savings = 50000;
    s.eventBag = ['diebe'];
    drawEvent(s, p);
    expect(p.savings).toBe(50000);
    expect(p.gold).toBeLessThan(10000);
  });

  it('Kredite werden über die Laufzeit getilgt', () => {
    let s = game();
    s.players[0].gold = 0;
    s = actions.takeLoan(s, 'p1', 5000, 3);
    expect(s.players[0].gold).toBe(5000);
    s.players[0].gold = 1e6;
    for (let i = 0; i < 3; i++) {
      for (const p of s.players) if (p.isAI) s = planAiTurn(s, p.id);
      s = resolveYear(s);
    }
    expect(s.players[0].loans).toHaveLength(0);
  });
});

describe('Militär & Lehnswesen', () => {
  it('Ritter blockieren 50 ha Land und werden bei Landmangel landlos', () => {
    const s = game();
    const p = s.players[0];
    const free = freeLand(p);
    p.military.knights = 10;
    expect(freeLand(p)).toBe(free - 500);
    p.land = 0 + 200; // nur Platz für 4 Lehen
    expect(landlessKnights(p)).toBe(6);
  });

  it('Ritter gibt es nur per Ritterschlag (Graf, erfahrene Knappen)', () => {
    let s = game();
    const p = s.players[0];
    p.gold = 1e6;
    p.title = T.FREIHERR;
    s = actions.recruit(s, p.id, 'squires', 10);
    expect(() => actions.knight(s, p.id, 5)).toThrow(/Graf/);
    s.players[0].title = T.GRAF;
    expect(() => actions.knight(s, p.id, 5)).toThrow(/Erfahrung/);
    s.players[0].military.squireXp = 2;
    s = actions.knight(s, p.id, 5);
    expect(s.players[0].military.knights).toBe(5);
    expect(s.players[0].military.squires).toBe(5);
  });

  it('Verlierer einer Schlacht büßt Land und Bargeld ein', () => {
    const s = game();
    const [a, d] = s.players;
    a.military.mercenaries = 500;
    d.military.mercenaries = 5;
    d.gold = 10000;
    const landD = d.land;
    const r = resolveAttack(s, { kind: 'attack', id: 'x', from: a.id, target: d.id, fraction: 1, marchCost: 0 }, { [a.id]: 1 })!;
    expect(r.attackerWon).toBe(true);
    expect(d.land).toBeLessThan(landD);
    expect(d.gold).toBeLessThan(10000);
    expect(d.grudges[a.id]).toBeGreaterThan(0);
  });

  it('Marschbefehl landet in der Queue und lässt sich erstatten', () => {
    let s = game();
    s.year += 1; // kein Landfrieden mehr
    const gold = s.players[0].gold;
    s = actions.queueAttack(s, 'p1', 'p2', 0.5);
    expect(s.queue).toHaveLength(1);
    expect(s.players[0].gold).toBeLessThan(gold);
    s = actions.cancelAction(s, 'p1', s.queue[0].id);
    expect(s.queue).toHaveLength(0);
    expect(s.players[0].gold).toBe(gold);
  });
});

describe('Taverne', () => {
  it('Erfolgschance = Gold / (Gold + Garde × Justiz), Attentat max. 25 %', () => {
    const s = game();
    const t = s.players[1];
    t.military.guards = 0;
    expect(covertChance(100, t, 'spy')).toBeCloseTo(0.5);
    expect(covertChance(1e9, t, 'assassinate')).toBe(0.25);
    t.military.guards = 100;
    t.justice = 5;
    expect(covertChance(1000, t, 'rob')).toBeLessThan(covertChance(1000, { ...t, justice: 1 }, 'rob'));
  });

  it('Steuereintreiber-Raub: fängt Steuern ab, Sparkonto bleibt sicher', () => {
    let s = game(2);
    const [thief, victim] = s.players;
    thief.title = T.GRAF;
    victim.military.guards = 0;
    victim.gold = 0; // nichts in der Schatzkammer
    victim.savings = 50000;
    let ok = false;
    for (let i = 0; i < 20 && !ok; i++) ok = resolveCovert(s, { kind: 'covert', id: 'c', from: thief.id, target: victim.id, mission: 'rob', gold: 100000 });
    expect(ok).toBe(true);
    const skim = victim.taxIntercepted ?? 0;
    expect(skim).toBeGreaterThan(0);
    expect(thief.loot).toBe(skim);
    // Bei der Jahresabrechnung fehlt das Abgefangene in der Kasse des Opfers.
    s.queue = [];
    s = resolveYear(s);
    const v = s.players[1];
    expect(v.savings).toBeGreaterThanOrEqual(50000);
    expect(v.lastReport!.taxIntercepted).toBe(skim);
    expect(v.taxIntercepted).toBe(0);
  });

  it('Intrigen werden erst beim Jahreswechsel aufgelöst', () => {
    let s = game();
    s.players[0].title = T.GRAF;
    s.players[0].gold = 200000;
    s.players[1].military.guards = 0;
    const goldTarget = s.players[1].gold;
    s = actions.queueCovert(s, 'p1', 'p2', 'rob', 100000);
    expect(s.players[1].gold).toBe(goldTarget);
    expect(s.queue[0].kind).toBe('covert');
  });
});

describe('Ereignis-Deck (Shuffle-Bag)', () => {
  it('enthält 20 Karten und wiederholt sich erst nach dem Mischen', () => {
    const s = game();
    const bag = freshEventBag(s);
    expect(bag).toHaveLength(20);
    expect(EVENT_CARDS.reduce((sum, c) => sum + c.count, 0)).toBe(20);
  });

  it('Pest trifft nur Länder mit mehr als 3.000 Einwohnern', () => {
    const s = game();
    const p = s.players[0];
    p.population = 2000;
    s.eventBag = ['pest', 'ruhig'];
    expect(drawEvent(s, p)).toBe('ruhig');
    expect(s.eventBag).toEqual(['pest']);
    p.population = 5000;
    expect(drawEvent(s, p)).toBe('pest');
    expect(p.population).toBeLessThan(5000);
  });
});

describe('Titel', () => {
  it('max. eine Beförderung pro Runde, alle Bedingungen gleichzeitig', () => {
    const s = game();
    const p = s.players[0];
    p.land = 100000;
    p.population = 50000;
    p.buildings = { market: 20, mill: 20, granary: 0, palace: 10, cathedral: 2 };
    p.military.knights = 100;
    expect(canBePromoted(p)).toBe(true);
    checkTitles(s);
    expect(p.title).toBe(1);
    checkTitles(s);
    expect(p.title).toBe(2);
  });

  it('massiver Landverlust (> 50 %) führt zur Rückstufung', () => {
    const s = game();
    const p = s.players[0];
    p.title = T.GRAF;
    p.landAtYearStart = 20000;
    p.land = 9000;
    checkTitles(s);
    expect(p.title).toBe(T.BARON);
  });
});

describe('Reichstag', () => {
  function electionGame(): GameState {
    const s = game(3);
    const k = s.players[0];
    k.title = T.KOENIG;
    k.buildings.cathedral = 1;
    s.election = {
      year: s.year,
      candidates: [k.id],
      seats: Array.from({ length: 7 }, (_, i) => ({ kind: 'bishop' as const, name: `Bischof ${i}`, bias: 0 })),
    };
    return s;
  }

  it('Kirchenfürsten enthalten sich ohne Überzeugung → Patt, Geld verfällt', () => {
    const s = electionGame();
    s.players[0].gold = 100000;
    s.queue.push({ kind: 'bribe', id: 'b1', from: 'p1', seat: 0, gold: BISHOP_MIN_SCORE });
    s.players[0].gold -= BISHOP_MIN_SCORE;
    const r = resolveElection(s)!;
    expect(r.winner).toBeNull();
    expect(s.players[0].gold).toBe(100000 - BISHOP_MIN_SCORE);
    expect(s.election).toBeNull();
  });

  it('4 von 7 Stimmen krönen den Kaiser', () => {
    const s = electionGame();
    for (let i = 0; i < 4; i++) s.queue.push({ kind: 'bribe', id: `b${i}`, from: 'p1', seat: i, gold: BISHOP_MIN_SCORE });
    const r = resolveElection(s)!;
    expect(r.winner).toBe('p1');
    expect(s.players[0].title).toBe(T.KAISER);
    expect(s.phase).toBe('ended');
  });
});

describe('KI', () => {
  it('spielt nach denselben Regeln und verändert keine fremden Spieler', () => {
    const s = game(3);
    s.year += 3;
    const otherBefore = JSON.stringify(s.players[0]);
    const after = planAiTurn(s, 'p2');
    expect(JSON.stringify(after.players[0])).toBe(otherBefore);
    expect(after.players[1].turnDone).toBe(true);
    expect(after.players[1].gold).toBeGreaterThanOrEqual(0);
  });

  it('mut-Aktionen werfen ActionError bei Regelverstößen', () => {
    const s = game();
    s.players[0].gold = 0;
    expect(() => mut.buyLand(s, 'p1', 1000)).toThrow(ActionError);
  });

  it('Engpass-Multiplikator: einziger Blocker ×3, größter Engpass ×2, sonst ×1,5', () => {
    const s = game();
    const p = s.players[0];
    // Freiherr: Land 12.000, Bevölkerung 2.500, 1 Markt
    p.land = 12000;
    p.population = 2500;
    expect(blockerBoost(p, ['market'])).toBe(TITLE_BLOCKER_MULTIPLIER);
    p.land = 6000;
    expect(blockerBoost(p, ['market'])).toBe(2); // 0 % erfüllt = größter Engpass
    expect(blockerBoost(p, ['land'])).toBe(1.5);
    expect(blockerBoost(p, ['cathedral'])).toBe(1);
  });

  it('Kirchenfürst spart im Early Game nicht auf Kathedralen', () => {
    const s = game();
    const p = { ...s.players[0], archetype: 'kirchenfuerst' as const };
    const base = ARCHETYPES.kirchenfuerst.weights;
    expect(effectiveWeights({ ...p, title: T.BARON }, base).piety).toBe(base.piety / 2);
    expect(effectiveWeights({ ...p, title: T.BARON }, base).economy).toBeGreaterThan(base.economy);
    expect(effectiveWeights({ ...p, title: T.HERZOG }, base).piety).toBe(base.piety);
  });

  it('Ränkeschmiedin investiert Raubbeute (Blutgeld) sofort', () => {
    let s = game(2);
    s.year += 2;
    const r = s.players[1];
    r.archetype = 'raenkeschmiedin';
    r.title = T.GRAF;
    s.players[0].military.guards = 0;
    s.players[0].gold = 200000;
    s.rng = 1;
    let robbed = false;
    for (let i = 0; i < 20 && !robbed; i++) robbed = resolveCovert(s, { kind: 'covert', id: 'c', from: r.id, target: 'p1', mission: 'rob', gold: 100000 });
    expect(robbed).toBe(true);
    expect(r.loot).toBeGreaterThan(0);
    // Vergleich: identischer Zustand, aber ohne gemerkte Beute
    const noLoot = structuredClone(s);
    noLoot.players[1].loot = 0;
    const withLoot = planAiTurn(s, r.id).players[1];
    const without = planAiTurn(noLoot, r.id).players[1];
    const value = (p: typeof r) => p.land * s.market.landPrice + (p.buildings.market + p.buildings.mill) * 3500;
    expect(withLoot.loot).toBe(0);
    expect(value(withLoot)).toBeGreaterThan(value(without));
  });

  it('erfolgreiches Ausspähen hinterlegt exakte Werte als Intel', () => {
    const s = game(2);
    s.players[1].military.guards = 0;
    let ok = false;
    for (let i = 0; i < 20 && !ok; i++) ok = resolveCovert(s, { kind: 'covert', id: 'c', from: 'p1', target: 'p2', mission: 'spy', gold: 100000 });
    expect(s.players[0].intel?.p2?.guards).toBe(0);
    expect(s.players[0].intel?.p2?.year).toBe(s.year);
  });

  it('Ritter-Vorlauf: Pipeline startet schon einen Titel vor dem Bedarf', () => {
    const s = game();
    const p = s.players[0];
    p.title = T.GRAF; // Fürst braucht keine Ritter, der Herzog danach 10
    expect(knightGoal(p)).toBe(10);
    p.title = T.BARON;
    expect(knightGoal(p)).toBe(0);
  });

  it('Ziel-Scoring: Führender ×3,5, Schuldturm ×0,1, Groll zählt mit', () => {
    const s = game(4);
    const [me, a, b, c] = s.players;
    a.land = 100000; // klar Führender
    b.debtorPrison = 1;
    me.grudges[c.id] = 40;
    const byId = Object.fromEntries(intrigueTargetScores(s, me).map((x) => [x.target.id, x.score]));
    expect(byId[a.id]).toBe(20 * 3.5);
    expect(byId[b.id]).toBeCloseTo(2);
    expect(byId[c.id]).toBe(60);
  });
});
