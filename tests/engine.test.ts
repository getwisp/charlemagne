import { describe, expect, it } from 'vitest';
import {
  actions,
  ActionError,
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
});
