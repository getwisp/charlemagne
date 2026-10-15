// Spieleraktionen. Aktionen, die nur den eigenen Zustand betreffen (Handel,
// Bau, Rekrutierung, Bank), wirken sofort – die Preise sind für das Jahr fix.
// Aktionen gegen andere Spieler (Krieg, Taverne, Bestechung) landen in der
// Action-Queue und werden erst beim Rundenwechsel aufgelöst.
//
// Jede Aktion gibt es in zwei Formen: `mut.*` verändert einen Entwurf (für die
// KI und Tests), die exportierte Variante arbeitet rein funktional.

import {
  BUILDINGS,
  COVERT,
  COVERT_MIN_GOLD,
  EARLY_REPAYMENT_FEE,
  FIEF_HECTARES,
  GRAIN_TRADE_UNIT,
  HECTARES_PER_BUILDING,
  KNIGHT_MIN_XP,
  LOAN_TERMS,
  SELL_SPREAD,
  T,
  TAX_LIMITS,
  TITLES,
  UNITS,
} from './constants';
import { assetValue, creditLimit, freeLand } from './economy';
import { createLoan, loanRate } from './bank';
import { armySize, entrenchCost, maneuverCost, marchCost } from './military';
import type {
  BuildingType,
  CovertMission,
  DismissableUnit,
  GameState,
  Player,
  RecruitableUnit,
  SabotageTarget,
  Taxes,
} from './types';
import { ActionError, clamp, clone, getPlayer, nextId } from './util';

function actor(s: GameState, playerId: string): Player {
  if (s.phase !== 'orders') throw new ActionError('Das Spiel ist beendet.');
  const p = getPlayer(s, playerId);
  if (p.turnDone) throw new ActionError('Ihr habt Euren Zug bereits beendet.');
  if (p.debtorPrison > 0) throw new ActionError('Ihr sitzt im Schuldturm und könnt nichts befehlen.');
  if (p.sickbed > 0) throw new ActionError('Ihr liegt im Krankenbett.');
  return p;
}

function int(n: number, what = 'Menge'): number {
  if (!Number.isFinite(n) || n < 0) throw new ActionError(`Ungültige ${what}.`);
  return Math.floor(n);
}

function pay(p: Player, cost: number): void {
  if (cost > p.gold) throw new ActionError(`Nicht genug Gold (benötigt: ${Math.ceil(cost).toLocaleString('de-DE')} Taler).`);
  p.gold -= cost;
}

export function grainBuyCost(s: GameState, scheffel: number): number {
  return Math.ceil(scheffel / GRAIN_TRADE_UNIT) * s.market.grainPrice;
}
export function grainSellValue(s: GameState, scheffel: number): number {
  return Math.floor((Math.floor(scheffel / GRAIN_TRADE_UNIT) * s.market.grainPrice) * SELL_SPREAD);
}
export function landSellPrice(s: GameState): number {
  return Math.floor(s.market.landPrice * SELL_SPREAD);
}

export const mut = {
  buyGrain(s: GameState, pid: string, scheffel: number): void {
    const p = actor(s, pid);
    const units = Math.ceil(int(scheffel) / GRAIN_TRADE_UNIT);
    pay(p, units * s.market.grainPrice);
    p.grain += units * GRAIN_TRADE_UNIT;
  },

  sellGrain(s: GameState, pid: string, scheffel: number): void {
    const p = actor(s, pid);
    const units = Math.floor(int(scheffel) / GRAIN_TRADE_UNIT);
    if (units * GRAIN_TRADE_UNIT > p.grain) throw new ActionError('So viel Korn habt Ihr nicht.');
    p.grain -= units * GRAIN_TRADE_UNIT;
    p.gold += grainSellValue(s, units * GRAIN_TRADE_UNIT);
  },

  buyLand(s: GameState, pid: string, ha: number): void {
    const p = actor(s, pid);
    const n = int(ha);
    pay(p, n * s.market.landPrice);
    p.land += n;
  },

  sellLand(s: GameState, pid: string, ha: number): void {
    const p = actor(s, pid);
    const n = int(ha);
    if (n > freeLand(p)) throw new ActionError('Ihr könnt nur freies Ackerland verkaufen.');
    p.land -= n;
    p.gold += n * landSellPrice(s);
  },

  build(s: GameState, pid: string, type: BuildingType, count = 1): void {
    const p = actor(s, pid);
    const n = int(count);
    const def = BUILDINGS[type];
    if (p.title < def.minTitle) throw new ActionError(`${def.name} erfordert mindestens den Titel ${TITLES[def.minTitle]}.`);
    if (freeLand(p) < n * HECTARES_PER_BUILDING)
      throw new ActionError(`Jedes Gebäude benötigt ${HECTARES_PER_BUILDING.toLocaleString('de-DE')} ha freies Land.`);
    pay(p, n * def.cost);
    p.buildings[type] += n;
  },

  setRation(s: GameState, pid: string, pct: number): void {
    const p = actor(s, pid);
    p.ration = clamp(Math.round(pct), 0, 200);
  },

  setTaxes(s: GameState, pid: string, taxes: Partial<Taxes>): void {
    const p = actor(s, pid);
    p.taxes = {
      income: clamp(Math.round(taxes.income ?? p.taxes.income), 0, TAX_LIMITS.income),
      sales: clamp(Math.round(taxes.sales ?? p.taxes.sales), 0, TAX_LIMITS.sales),
      tolls: clamp(Math.round(taxes.tolls ?? p.taxes.tolls), 0, TAX_LIMITS.tolls),
    };
  },

  setJustice(s: GameState, pid: string, level: number): void {
    const p = actor(s, pid);
    p.justice = clamp(Math.round(level), 1, 5);
  },

  deposit(s: GameState, pid: string, amount: number): void {
    const p = actor(s, pid);
    const n = int(amount, 'Summe');
    pay(p, n);
    p.savings += n;
  },

  withdraw(s: GameState, pid: string, amount: number): void {
    const p = actor(s, pid);
    const n = int(amount, 'Summe');
    if (n > p.savings) throw new ActionError('So viel liegt nicht auf dem Sparkonto.');
    p.savings -= n;
    p.gold += n;
  },

  takeLoan(s: GameState, pid: string, amount: number, years: number): void {
    const p = actor(s, pid);
    const n = int(amount, 'Summe');
    if (n <= 0) throw new ActionError('Ungültige Summe.');
    if (!LOAN_TERMS.includes(years)) throw new ActionError('Ungültige Laufzeit.');
    if (p.loans.length >= 5) throw new ActionError('Die Bank gewährt höchstens 5 Kredite gleichzeitig.');
    if (n > creditLimit(p, s.market)) throw new ActionError('Die Bank verweigert einen so hohen Kredit.');
    const rate = loanRate(p, s.market, assetValue(p, s.market));
    p.loans.push(createLoan(s, n, rate, years));
    p.gold += n;
  },

  repayLoan(s: GameState, pid: string, loanId: string): void {
    const p = actor(s, pid);
    const loan = p.loans.find((l) => l.id === loanId);
    if (!loan) throw new ActionError('Kredit nicht gefunden.');
    pay(p, Math.ceil(loan.remaining * (1 + EARLY_REPAYMENT_FEE)));
    p.loans = p.loans.filter((l) => l.id !== loanId);
  },

  recruit(s: GameState, pid: string, unit: RecruitableUnit, count: number): void {
    const p = actor(s, pid);
    const n = int(count);
    const def = UNITS[unit];
    if (p.title < def.minTitle) throw new ActionError(`${def.plural} erfordern mindestens den Titel ${TITLES[def.minTitle]}.`);
    if (def.fromPopulation && n > p.population * 0.2)
      throw new ActionError('So viele wehrfähige Männer gibt Eure Bevölkerung nicht her.');
    pay(p, n * def.cost);
    const m = p.military;
    if (unit === 'squires' && n > 0) m.squireXp = (m.squireXp * m.squires) / (m.squires + n);
    if (unit !== 'guards' && n > 0) {
      const army = armySize(m);
      m.training = (m.training * army + 0.8 * n) / (army + n);
    }
    m[unit] += n;
    if (def.fromPopulation) p.population -= n;
  },

  dismiss(s: GameState, pid: string, unit: DismissableUnit, count: number): void {
    const p = actor(s, pid);
    const n = int(count);
    if (n > p.military[unit]) throw new ActionError('So viele Einheiten habt Ihr nicht.');
    p.military[unit] -= n;
    if (unit === 'guards' || unit === 'squires') p.population += n;
    if (p.military.squires === 0) p.military.squireXp = 0;
  },

  /** Ritterschlag: Knappen mit genug Erfahrung werden gegen Gebühr zu Rittern. */
  knight(s: GameState, pid: string, count: number): void {
    const p = actor(s, pid);
    const n = int(count);
    if (p.title < T.GRAF) throw new ActionError('Nur ein Graf oder höher darf Ritter schlagen.');
    if (n > p.military.squires) throw new ActionError('Nicht genug Knappen.');
    if (p.military.squireXp < KNIGHT_MIN_XP) throw new ActionError('Eure Knappen brauchen mehr Manöver-Erfahrung.');
    if (freeLand(p) < n * FIEF_HECTARES) throw new ActionError(`Jeder Ritter benötigt ${FIEF_HECTARES} ha freies Land als Lehen.`);
    pay(p, n * UNITS.knights.cost);
    p.military.squires -= n;
    p.military.knights += n;
    if (p.military.squires === 0) p.military.squireXp = 0;
  },

  setManeuver(s: GameState, pid: string, on: boolean): void {
    const p = actor(s, pid);
    if (on === p.maneuver) return;
    if (on) {
      if (armySize(p.military) === 0) throw new ActionError('Ihr habt kein Heer für ein Manöver.');
      pay(p, maneuverCost(p));
    } else p.gold += maneuverCost(p);
    p.maneuver = on;
  },

  setEntrenched(s: GameState, pid: string, on: boolean): void {
    const p = actor(s, pid);
    if (on === p.entrenched) return;
    if (on) pay(p, entrenchCost(p));
    else p.gold += entrenchCost(p);
    p.entrenched = on;
  },

  queueAttack(s: GameState, pid: string, target: string, fraction: number): string {
    const p = actor(s, pid);
    const t = getPlayer(s, target);
    if (t.id === p.id) throw new ActionError('Ihr könnt Euch nicht selbst angreifen.');
    if (s.year === s.startYear) throw new ActionError('Im ersten Jahr herrscht Landfrieden.');
    const f = clamp(fraction, 0.1, 1);
    const already = s.queue.filter((a) => a.kind === 'attack' && a.from === pid);
    const used = already.reduce((sum, a) => sum + (a.kind === 'attack' ? a.fraction : 0), 0);
    if (used + f > 1.0001) throw new ActionError('So viele Truppen sind nicht mehr verfügbar.');
    if (armySize(p.military) * f < 1) throw new ActionError('Ihr habt kein Heer, das ausrücken könnte.');
    const cost = marchCost(p, f, target);
    pay(p, cost);
    const id = nextId(s, 'a');
    s.queue.push({ kind: 'attack', id, from: pid, target, fraction: f, marchCost: cost });
    return id;
  },

  queueCovert(
    s: GameState,
    pid: string,
    target: string,
    mission: CovertMission,
    gold: number,
    sabotageTarget?: SabotageTarget,
  ): string {
    const p = actor(s, pid);
    const t = getPlayer(s, target);
    if (t.id === p.id) throw new ActionError('Ihr könnt nicht gegen Euch selbst intrigieren.');
    const def = COVERT[mission];
    if (p.title < def.minTitle) throw new ActionError(`${def.name} erfordert mindestens den Titel ${TITLES[def.minTitle]}.`);
    const g = int(gold, 'Summe');
    if (g < COVERT_MIN_GOLD) throw new ActionError(`Mindesteinsatz: ${COVERT_MIN_GOLD} Taler.`);
    pay(p, g);
    const id = nextId(s, 'a');
    s.queue.push({ kind: 'covert', id, from: pid, target, mission, gold: g, sabotageTarget });
    return id;
  },

  placeBribe(s: GameState, pid: string, seat: number, gold: number): string {
    const p = actor(s, pid);
    const e = s.election;
    if (!e) throw new ActionError('Es ist keine Kaiserwahl ausgerufen.');
    if (!e.candidates.includes(pid)) throw new ActionError('Nur Kandidaten können Stimmen kaufen.');
    const st = e.seats[seat];
    if (!st) throw new ActionError('Unbekannter Sitz.');
    if (st.kind === 'player' && st.playerId === pid) throw new ActionError('Ihr könnt Euch nicht selbst bestechen.');
    const g = int(gold, 'Summe');
    if (g <= 0) throw new ActionError('Ungültige Summe.');
    pay(p, g);
    const id = nextId(s, 'a');
    s.queue.push({ kind: 'bribe', id, from: pid, seat, gold: g });
    return id;
  },

  castVote(s: GameState, pid: string, candidate: string): void {
    const p = actor(s, pid);
    const e = s.election;
    if (!e) throw new ActionError('Es ist keine Kaiserwahl ausgerufen.');
    if (!e.seats.some((st) => st.kind === 'player' && st.playerId === p.id))
      throw new ActionError('Ihr habt keine Stimme im Wahlkollegium.');
    if (!e.candidates.includes(candidate)) throw new ActionError('Kein gültiger Kandidat.');
    s.queue = s.queue.filter((a) => !(a.kind === 'vote' && a.from === pid));
    s.queue.push({ kind: 'vote', id: nextId(s, 'a'), from: pid, candidate });
  },

  /** Storniert eine eigene Aktion aus der Queue und erstattet die Kosten. */
  cancelAction(s: GameState, pid: string, actionId: string): void {
    const p = actor(s, pid);
    const a = s.queue.find((q) => q.id === actionId && q.from === pid);
    if (!a) throw new ActionError('Aktion nicht gefunden.');
    if (a.kind === 'attack') p.gold += a.marchCost;
    if (a.kind === 'covert' || a.kind === 'bribe') p.gold += a.gold;
    s.queue = s.queue.filter((q) => q.id !== actionId);
  },

  endTurn(s: GameState, pid: string): void {
    const p = getPlayer(s, pid);
    if (s.phase !== 'orders') throw new ActionError('Das Spiel ist beendet.');
    p.turnDone = true;
  },
};

type MutFns = typeof mut;
type Pure<F> = F extends (s: GameState, ...args: infer A) => unknown ? (s: GameState, ...args: A) => GameState : never;

function pure<K extends keyof MutFns>(key: K): Pure<MutFns[K]> {
  return ((s: GameState, ...args: unknown[]) => {
    const draft = clone(s);
    (mut[key] as (s: GameState, ...a: unknown[]) => unknown)(draft, ...args);
    return draft;
  }) as Pure<MutFns[K]>;
}

export const actions = {
  buyGrain: pure('buyGrain'),
  sellGrain: pure('sellGrain'),
  buyLand: pure('buyLand'),
  sellLand: pure('sellLand'),
  build: pure('build'),
  setRation: pure('setRation'),
  setTaxes: pure('setTaxes'),
  setJustice: pure('setJustice'),
  deposit: pure('deposit'),
  withdraw: pure('withdraw'),
  takeLoan: pure('takeLoan'),
  repayLoan: pure('repayLoan'),
  recruit: pure('recruit'),
  dismiss: pure('dismiss'),
  knight: pure('knight'),
  setManeuver: pure('setManeuver'),
  setEntrenched: pure('setEntrenched'),
  queueAttack: pure('queueAttack'),
  queueCovert: pure('queueCovert'),
  placeBribe: pure('placeBribe'),
  castVote: pure('castVote'),
  cancelAction: pure('cancelAction'),
  endTurn: pure('endTurn'),
};

/** Darf der Spieler in diesem Jahr Befehle geben? */
export function canAct(p: Player): boolean {
  return p.debtorPrison <= 0 && p.sickbed <= 0;
}
