// KI nach menschlichen Archetypen (Utility-System).
// Die KI nutzt exakt dieselben Aktionen wie der Mensch – kein Gratis-Gold.
// Budget in 4 Schritten: Überleben → Spekulation → Titel-Engpass → Militär/Sabotage.

import { mut } from './actions';
import {
  ARCHETYPES,
  BUILDINGS,
  CITY_MARKETS,
  CITY_MILLS,
  COVERT,
  FIEF_HECTARES,
  GRAIN_TRADE_UNIT,
  HECTARES_PER_BUILDING,
  HECTARES_PER_FARMER,
  KNIGHT_MIN_XP,
  T,
  TITLE_REQUIREMENTS,
  UNITS,
  YIELD_PER_HECTARE,
  type TitleRequirements,
} from './constants';
import { ALLIANCE_SHARE, COVERT_BASE_DEFENSE, COVERT_DEFENSE_PER_GUARD, JUSTICE_DEFENSE, ROB_CASH_SHARE, ROB_TAX_SHARE } from './constants';
import {
  buildingUpkeep,
  calculateEconomyTurn,
  creditLimit,
  expectedHarvest,
  freeLand,
  grainNeed,
  loanPaymentsDue,
  militaryUpkeep,
  score,
} from './economy';
import { hasPeace, offerBlocker, treatiesBetween } from './diplomacy';
import { armySize, attackPower, defenseBonus, defensePower, maneuverCost, morale } from './military';
import { publicArmyEstimate, publicInfo } from './intel';
import { chance, random } from './rng';
import { nextTitleRequirements, type RequirementStatus } from './titles';
import type { Archetype, BuildingType, CovertMission, GameState, Player, SpyIntel, TreatyType } from './types';
import { clone, getPlayer } from './util';

type Weights = (typeof ARCHETYPES)[Archetype]['weights'];

/** Führt eine Aktion aus und schluckt Regelverstöße (die KI probiert wie ein Mensch). */
function attempt(fn: () => void): boolean {
  try {
    fn();
    return true;
  } catch {
    return false;
  }
}

function me(s: GameState, id: string): Player {
  return getPlayer(s, id);
}

/** Geld, das für feste Kosten zurückgehalten wird. */
function reserve(p: Player): number {
  return militaryUpkeep(p) + buildingUpkeep(p.buildings) + loanPaymentsDue(p) + 800;
}

function budget(p: Player): number {
  return Math.max(0, p.gold - reserve(p));
}

/**
 * Ist eine Ressource der einzige Grund, warum die KI nicht aufsteigt, überschreibt
 * dieser Multiplikator kurzzeitig die Charakter-Gewichtung.
 */
export const TITLE_BLOCKER_MULTIPLIER = 3.0;

/** Ab diesem Titel mildert die KI ihre Justiz auf höchstens Stufe 3 (Hexenprozesse vermeiden). */
export const CROWN_CAUTION_TITLE = T.KURFUERST;

/** Charakter-Gewichte je nach Spielphase. */
export function effectiveWeights(p: Player, base: Weights): Weights {
  const w = { ...base };
  // Kathedralen verlangt erst der Kurfürst. Bis dahin wird nicht auf sie gespart:
  // Wachstum, Land und die ersten Städte zuerst.
  if (p.title < T.HERZOG) {
    w.piety *= 0.5;
    if (p.archetype === 'kirchenfuerst') w.economy += 0.4;
  }
  return w;
}

/**
 * Verstärkung für Aktionen, die eine offene Titel-Voraussetzung bedienen:
 * einziger Blocker → TITLE_BLOCKER_MULTIPLIER, größter Engpass → 2, sonstige offene → 1,5.
 */
export function blockerBoost(p: Player, keys: (keyof TitleRequirements)[]): number {
  const open = nextTitleRequirements(p).filter((r) => !r.met);
  const hits = open.filter((r) => keys.includes(r.key));
  if (hits.length === 0) return 1;
  if (open.length === 1) return TITLE_BLOCKER_MULTIPLIER;
  const worst = open.reduce((a, b) => (b.progress < a.progress ? b : a));
  return hits.includes(worst) ? 2 : 1.5;
}

/** Erwartetes Korndefizit (Scheffel), das jedes Jahr zugekauft werden muss. */
function grainDeficit(p: Player): number {
  const ration = Math.max(100, p.ration);
  return Math.max(0, (grainNeed(p) * ration) / 100 - expectedHarvest(p, 1));
}

/** Ackerland, das die eigene Ration aus eigener Ernte deckt. */
function farmlandTarget(p: Player): number {
  return Math.min(p.population * HECTARES_PER_FARMER, Math.ceil((grainNeed(p) * Math.max(100, p.ration)) / 100 / YIELD_PER_HECTARE));
}

/** Holt fehlendes Geld vom Sparkonto, statt es dort zu horten. */
function fund(s: GameState, p: Player, amount: number): void {
  const missing = amount - budget(p);
  if (missing > 0 && p.savings > 0) attempt(() => mut.withdraw(s, p.id, Math.min(p.savings, Math.ceil(missing))));
}

export function planAiTurn(state: GameState, playerId: string): GameState {
  const s = clone(state);
  const p = me(s, playerId);
  if (!p.isAI || p.turnDone || s.phase !== 'orders') return s;
  if (p.debtorPrison > 0 || p.sickbed > 0) {
    // Im Schuldturm oder Krankenbett: keine Befehle.
    attempt(() => mut.endTurn(s, p.id));
    return s;
  }
  const arch = ARCHETYPES[p.archetype ?? 'pfeffersack'];
  const w = effectiveWeights(p, arch.weights);
  // Blutgeld: Beute aus dem letzten Raubzug sofort in Land und Städte stecken.
  const loot = p.loot ?? 0;
  p.loot = 0;

  setPolicies(s, p, w);
  diplomacy(s, p);
  survival(s, p, arch.ration);
  speculation(s, p, w);
  // Die Ränkeschmiedin bezahlt ihre Agenten, bevor der Rest in Titel fließt.
  if (p.archetype === 'raenkeschmiedin' && s.year > s.startYear) leaderIntrigue(s, p, w);
  titleFocus(s, p, w);
  if (loot > 0) investBloodMoney(s, p, loot);
  generalInvestments(s, p, w);
  militaryAndIntrigue(s, p, w);
  electionPolitics(s, p);
  finalSafety(s, p);

  attempt(() => mut.endTurn(s, p.id));
  return s;
}

// ------------------------------------------------------------ Diplomatie
function isTreatyPartner(s: GameState, a: string, b: string): boolean {
  return treatiesBetween(s, a, b).length > 0;
}

/** Wer deutlich vorne liegt, bekommt keine Hilfe (Blue-Shell) – Handel und Bündnis lehnt man ab. */
function runawayLeader(s: GameState, p: Player): Player | null {
  const leader = [...s.players].sort((a, b) => score(b) - score(a))[0];
  return leader && leader.id !== p.id && score(leader) > score(p) * 1.2 ? leader : null;
}

/** Aufschlag auf das Schutzgeld, wenn der Bittsteller die Rangliste anführt. */
export const LEADER_TRIBUTE_FACTOR = 3;

/**
 * Mitgift, ab der eine KI auch ungeliebte Verträge unterschreibt. Sie richtet sich nach
 * dem Reicheren der beiden – der wohlhabendste Fürst zahlt am meisten – und der
 * Führende der Rangliste zahlt ein Vielfaches.
 */
export function aiTributeDemand(s: GameState, p: Player, from: Player): number {
  const base = 1000 + Math.max(score(p), score(from)) * 0.02;
  const leader = [...s.players].sort((a, b) => score(b) - score(a))[0];
  const factor = leader.id === from.id ? LEADER_TRIBUTE_FACTOR : 1;
  return Math.round((base * factor) / 100) * 100;
}

/** Würde die KI dieses Angebot annehmen? Öffentlich: auch für die Vorschau im Thronsaal nutzbar. */
export function aiAcceptsOffer(s: GameState, p: Player, from: Player, type: TreatyType, gold: number): boolean {
  const hostile = (p.grudges[from.id] ?? 0) >= 40 || p.casusBelli.includes(from.id);
  if (hostile) return false;
  const runaway = runawayLeader(s, p)?.id === from.id;
  const sweetener = gold >= aiTributeDemand(s, p, from);
  switch (type) {
    case 'nap':
      // Der Kriegstreiber bindet sich ungern – außer gegen gutes Geld oder einen übermächtigen Nachbarn.
      if (p.archetype === 'kriegstreiber') return sweetener || publicArmyEstimate(from) > attackPower(p, 1) * 1.3;
      return true;
    case 'trade':
      return !runaway || sweetener;
    case 'alliance':
      if (runaway) return false;
      if (p.archetype === 'kriegstreiber') return sweetener;
      return true;
  }
}

/** Beantwortet Angebote und schlägt selbst Verträge vor (höchstens einen je Jahr). */
function diplomacy(s: GameState, p: Player): void {
  for (const o of (s.offers ?? []).filter((x) => x.to === p.id)) {
    const from = me(s, o.from);
    if (aiAcceptsOffer(s, p, from, o.type, o.gold)) attempt(() => mut.acceptOffer(s, p.id, o.id));
    else attempt(() => mut.declineOffer(s, p.id, o.id));
  }
  if (s.year === s.startYear) return;

  const rivals = s.players.filter((o) => o.id !== p.id && o.debtorPrison === 0);
  const friendly = rivals.filter((o) => (p.grudges[o.id] ?? 0) < 40 && !p.casusBelli.includes(o.id));
  const leader = runawayLeader(s, p);
  const canOffer = (o: Player, t: TreatyType) => offerBlocker(s, p.id, o.id, t) === null;
  const offer = (o: Player | undefined, t: TreatyType) => !!o && attempt(() => mut.offerTreaty(s, p.id, o.id, t, 0));

  // Koalition gegen den Enteilten: Bündnis mit dem stärksten anderen Verfolger.
  if (leader && p.archetype !== 'kriegstreiber' && chance(s, 0.3)) {
    const partner = friendly
      .filter((o) => o.id !== leader.id && canOffer(o, 'alliance'))
      .sort((a, b) => publicArmyEstimate(b) - publicArmyEstimate(a))[0];
    if (offer(partner, 'alliance')) return;
  }
  // Frieden mit dem gefährlichsten Nachbarn – nur wer nicht selbst erobern will.
  const napChance = p.archetype === 'kirchenfuerst' || p.archetype === 'raenkeschmiedin' ? 0.4 : p.archetype === 'pfeffersack' ? 0.25 : 0;
  if (napChance > 0 && chance(s, napChance)) {
    const strongest = friendly.filter((o) => canOffer(o, 'nap')).sort((a, b) => publicArmyEstimate(b) - publicArmyEstimate(a))[0];
    if (strongest && publicArmyEstimate(strongest) > defensePower(p) * 0.5) {
      // Frieden mit einem Kriegstreiber gibt es nur gegen Tribut – wenn die Kasse ihn hergibt.
      const tribute = strongest.archetype === 'kriegstreiber' ? aiTributeDemand(s, strongest, p) : 0;
      if (tribute <= budget(p) * 0.3) {
        fund(s, p, tribute);
        if (attempt(() => mut.offerTreaty(s, p.id, strongest.id, 'nap', tribute))) return;
      }
    }
  }
  // Handel: der Pfeffersack sucht ihn aktiv, die anderen gelegentlich.
  const tradeChance = p.archetype === 'pfeffersack' ? 0.5 : 0.15;
  if (chance(s, tradeChance)) {
    const partner = friendly
      .filter((o) => o.id !== leader?.id && canOffer(o, 'trade'))
      .sort((a, b) => publicInfo(b).population - publicInfo(a).population)[0];
    offer(partner, 'trade');
  }
}

// ------------------------------------------------------------ Politik
function setPolicies(s: GameState, p: Player, w: Weights): void {
  const arch = p.archetype ?? 'pfeffersack';
  const base = {
    pfeffersack: { income: 18, sales: 12, tolls: 12 },
    kriegstreiber: { income: 25, sales: 10, tolls: 10 },
    raenkeschmiedin: { income: 20, sales: 11, tolls: 11 },
    kirchenfuerst: { income: 18, sales: 10, tolls: 10 },
  }[arch];
  // In Geldnot werden die Steuern angezogen.
  const tight = p.gold < reserve(p) * 1.5;
  attempt(() =>
    mut.setTaxes(s, p.id, {
      income: base.income + (tight ? 6 : 0),
      sales: base.sales + (tight ? 3 : 0),
      tolls: base.tolls + (tight ? 3 : 0),
    }),
  );
  // Vor der Krone die Richter zügeln: strenge Justiz bringt Hexenprozesse, und Skandale kosten Bischofsstimmen.
  const justice = p.title >= CROWN_CAUTION_TITLE ? Math.min(3, ARCHETYPES[arch].justice) : ARCHETYPES[arch].justice;
  attempt(() => mut.setJustice(s, p.id, justice));
  void w;
}

// ------------------------------------------------------------ 1. Überleben
function survival(s: GameState, p: Player, ration: number): void {
  const need = grainNeed(p);
  // Wer sein Korn zukaufen muss, füttert kein Bevölkerungswachstum auf Pump.
  const importing = grainDeficit({ ...p, ration: 100 } as Player) > need * 0.15;
  attempt(() => mut.setRation(s, p.id, importing ? Math.min(ration, 100) : ration));
  let wanted = Math.ceil((need * p.ration) / 100);
  if (p.grain < wanted) {
    const missing = wanted - p.grain;
    const units = Math.ceil(missing / GRAIN_TRADE_UNIT);
    const affordable = Math.floor(p.gold / s.market.grainPrice);
    if (units > affordable && p.savings > 0) {
      attempt(() => mut.withdraw(s, p.id, Math.min(p.savings, (units - affordable) * s.market.grainPrice)));
    }
    const canBuy = Math.min(units, Math.floor(p.gold / s.market.grainPrice));
    if (canBuy > 0) attempt(() => mut.buyGrain(s, p.id, canBuy * GRAIN_TRADE_UNIT));
    if (p.grain < wanted) {
      // Lieber knapper rationieren als hungern lassen.
      attempt(() => mut.setRation(s, p.id, Math.max(0, Math.floor((p.grain / Math.max(1, need)) * 100))));
    }
  }
  wanted = Math.ceil((need * p.ration) / 100);

  // Teure Kredite tilgen, wenn reichlich Gold vorhanden ist.
  for (const loan of [...p.loans].sort((a, b) => b.rate - a.rate)) {
    if (p.gold > reserve(p) + loan.remaining * 1.02 + 5000) attempt(() => mut.repayLoan(s, p.id, loan.id));
  }
}

// ------------------------------------------------------------ 2. Spekulation
function speculation(s: GameState, p: Player, w: Weights): void {
  const need = grainNeed(p);
  const keep = Math.ceil((need * p.ration) / 100) + need * 0.3;
  const { grainPrice, landPrice } = s.market;

  // Dürre: Korn teuer verkaufen
  if (grainPrice >= 32 && p.grain > keep) {
    const surplus = Math.floor((p.grain - keep) * Math.min(1, 0.6 * w.speculation));
    if (surplus >= GRAIN_TRADE_UNIT) attempt(() => mut.sellGrain(s, p.id, surplus));
  } else if (grainPrice >= 20 && p.grain > keep * 1.8) {
    attempt(() => mut.sellGrain(s, p.id, Math.floor(p.grain - keep * 1.5)));
  }
  // Billiges Korn als Vorrat einlagern (wenn Kornspeicher vorhanden)
  if (grainPrice <= 10 && p.buildings.granary > 0 && p.grain < need * 1.8) {
    const units = Math.floor(Math.min(budget(p) * 0.2, (need * 1.8 - p.grain) / GRAIN_TRADE_UNIT * grainPrice) / grainPrice);
    if (units > 0) attempt(() => mut.buyGrain(s, p.id, units * GRAIN_TRADE_UNIT));
  }
  // Schleuderpreise: Land kaufen
  if (landPrice <= 15) {
    const ha = Math.floor((budget(p) * Math.min(0.6, 0.35 * w.speculation)) / landPrice);
    if (ha >= 100) attempt(() => mut.buyLand(s, p.id, ha));
  }
}

// ------------------------------------------------------------ 3. Titel-Engpass
function bottleneck(p: Player): RequirementStatus | null {
  const open = nextTitleRequirements(p).filter((r) => !r.met);
  if (open.length === 0) return null;
  return open.sort((a, b) => a.progress - b.progress)[0];
}

function ensureFreeLand(s: GameState, p: Player, ha: number, maxSpend: number): boolean {
  const missing = ha - freeLand(p);
  if (missing <= 0) return true;
  const cost = missing * s.market.landPrice;
  if (cost > Math.min(maxSpend, p.gold)) return false;
  return attempt(() => mut.buyLand(s, p.id, missing));
}

/** Baut ein Gebäude inkl. eventuell nötigem Landkauf. */
function tryBuild(s: GameState, p: Player, type: BuildingType, maxSpend: number): boolean {
  if (p.title < BUILDINGS[type].minTitle) return false;
  const def = BUILDINGS[type];
  // Nicht die eigenen Felder zubauen: genug Ackerland für die Ernährung behalten.
  const farmBuffer = Math.min(farmlandTarget(p) * 0.6, Math.max(1500, freeLand(p) - HECTARES_PER_BUILDING));
  const landNeeded = HECTARES_PER_BUILDING + farmBuffer;
  const landCost = Math.max(0, landNeeded - freeLand(p)) * s.market.landPrice;
  if (def.cost + landCost > maxSpend) return false;
  fund(s, p, def.cost + landCost);
  if (def.cost + landCost > budget(p)) return false;
  if (!ensureFreeLand(s, p, landNeeded, maxSpend - def.cost)) return false;
  return attempt(() => mut.build(s, p.id, type, 1));
}

/**
 * Ritter haben mindestens drei Jahre Vorlauf (Knappe → 2 Manöver → Ritterschlag).
 * Verlangt der nächste oder übernächste Titel Ritter, läuft die Pipeline daher
 * unabhängig vom Charakter-Gewicht – auch beim friedlichen Kirchenfürsten.
 */
export function knightGoal(p: Player): number {
  const next = TITLE_REQUIREMENTS[p.title + 1]?.knights ?? 0;
  const after = TITLE_REQUIREMENTS[p.title + 2]?.knights ?? 0;
  return Math.max(next, p.title + 2 <= T.KOENIG ? after : 0);
}

function knightLeadTime(s: GameState, p: Player): void {
  const goal = knightGoal(p);
  const missing = goal - p.military.knights;
  if (missing <= 0) return;
  knightPipeline(s, p, missing, budget(p) * 0.6);
}

function titleFocus(s: GameState, p: Player, w: Weights): void {
  knightLeadTime(s, p);
  // Mehrere Durchläufe: Engpass wechselt, sobald einer behoben ist.
  for (let round = 0; round < 4; round++) {
    const b = bottleneck(p);
    if (!b) return;
    const boost = blockerBoost(p, [b.key]);
    const sole = boost >= TITLE_BLOCKER_MULTIPLIER;
    // Engpass-Scanner: Ersparnisse fließen in den Titel statt aufs Konto.
    if (boost >= 2) fund(s, p, budget(p) + p.savings * (sole ? 0.9 : 0.5));
    const spend = budget(p) * (sole ? 0.95 : 0.8);
    if (spend < 500 && !sole) return;
    let progressed = false;
    switch (b.key) {
      case 'land': {
        const missing = b.required - b.current + 500;
        // Als einziger Blocker wird Land notfalls auf Kredit gekauft und nicht auf Schnäppchen gewartet.
        if (sole && missing * s.market.landPrice > spend) financeTitle(s, p, missing * s.market.landPrice - spend);
        const ha = Math.min(missing, Math.floor((sole ? budget(p) * 0.95 : spend) / s.market.landPrice));
        const maxPrice = sole ? Infinity : 30 + 10 * (w.land - 1);
        if (ha > 0 && s.market.landPrice <= maxPrice) progressed = attempt(() => mut.buyLand(s, p.id, ha));
        break;
      }
      case 'population': {
        attempt(() => mut.setRation(s, p.id, Math.max(p.ration, 140)));
        attempt(() => mut.setTaxes(s, p.id, { income: Math.min(p.taxes.income, 15) }));
        const wanted = Math.ceil((grainNeed(p) * p.ration) / 100);
        if (p.grain < wanted) {
          const units = Math.min(Math.ceil((wanted - p.grain) / GRAIN_TRADE_UNIT), Math.floor(spend / s.market.grainPrice));
          if (units > 0) attempt(() => mut.buyGrain(s, p.id, units * GRAIN_TRADE_UNIT));
        }
        if (p.grain < wanted) attempt(() => mut.setRation(s, p.id, Math.floor((p.grain / grainNeed(p)) * 100)));
        // Mehr Land erhöht die Tragfähigkeit
        if (p.population > p.land * 0.3) {
          const ha = Math.floor(Math.min(spend * 0.5, 2000 * s.market.landPrice) / s.market.landPrice);
          if (ha > 0) attempt(() => mut.buyLand(s, p.id, ha));
        }
        return; // Bevölkerung wächst über das Jahr, nicht sofort
      }
      case 'market':
      case 'mill':
      case 'palace':
      case 'cathedral':
        progressed = tryBuild(s, p, b.key, spend);
        if (!progressed && sole) {
          financeTitle(s, p, BUILDINGS[b.key].cost + HECTARES_PER_BUILDING * s.market.landPrice);
          progressed = tryBuild(s, p, b.key, budget(p));
        }
        break;
      case 'cities': {
        const needMarkets = p.buildings.market < CITY_MARKETS * (b.current + 1);
        const needMills = p.buildings.mill < CITY_MILLS * (b.current + 1);
        const type: BuildingType = needMarkets && (!needMills || p.buildings.market / CITY_MARKETS <= p.buildings.mill / CITY_MILLS) ? 'market' : 'mill';
        progressed = tryBuild(s, p, type, spend);
        break;
      }
      case 'knights':
        progressed = knightPipeline(s, p, b.required - b.current, spend);
        break;
      case 'gold':
        return;
    }
    if (!progressed) return;
  }
}

/** Kredit für den letzten fehlenden Baustein zum Titel – nur maßvoll und solange die Raten tragbar sind. */
function financeTitle(s: GameState, p: Player, gap: number): void {
  if (p.loans.length >= 2) return;
  const preview = calculateEconomyTurn(p, s.market);
  const amount = Math.min(Math.ceil(gap), Math.floor(creditLimit(p, s.market) * 0.5));
  // Die Jahresrate (5 Jahre) darf höchstens die Hälfte des Überschusses fressen.
  if (amount < 1000 || amount / 4 > Math.max(0, preview.netGold) * 0.5) return;
  attempt(() => mut.takeLoan(s, p.id, amount, 5));
}

/** Knappen anheuern → Manöver → Ritterschlag */
function knightPipeline(s: GameState, p: Player, wanted: number, spend: number): boolean {
  let did = false;
  const m = p.military;
  if (p.title >= T.GRAF && m.squireXp >= KNIGHT_MIN_XP && m.squires > 0) {
    const n = Math.min(m.squires, wanted, Math.floor(spend / UNITS.knights.cost));
    if (n > 0) {
      ensureFreeLand(s, p, n * FIEF_HECTARES + 200, spend);
      did = attempt(() => mut.knight(s, p.id, n)) || did;
    }
  }
  const pipeline = m.squires;
  if (pipeline < wanted && (m.squires === 0 || m.squireXp < 1)) {
    const n = Math.min(wanted - pipeline, Math.floor((budget(p) * 0.5) / UNITS.squires.cost));
    if (n > 0) did = attempt(() => mut.recruit(s, p.id, 'squires', n)) || did;
  }
  if (m.squires > 0 && !p.maneuver && maneuverCost(p) < budget(p)) did = attempt(() => mut.setManeuver(s, p.id, true)) || did;
  return did;
}

// ------------------------------------------------------------ Utility-Investitionen
interface Option {
  name: string;
  utility: number; // 0–100
  weight: number;
  run: () => boolean;
}

function generalInvestments(s: GameState, p: Player, w: Weights): void {
  for (let i = 0; i < 3; i++) {
    const spend = budget(p) * 0.6;
    if (spend < 2000) return;
    const ratRisk = p.grain > grainNeed(p) * 0.8;
    // Kornimporte fressen das Budget: Ackerland zahlt doppelt (Ernte + Titel-Land).
    const deficitShare = grainDeficit(p) / Math.max(1, grainNeed(p));
    const landUtility = deficitShare > 0.1 ? 50 + Math.min(40, deficitShare * 60) : freeLand(p) < farmlandTarget(p) ? 45 : 20;
    const hasOpenGoal = nextTitleRequirements(p).some((r) => !r.met);
    const options: Option[] = [
      { name: 'Markt', utility: 60, weight: w.economy * blockerBoost(p, ['market', 'cities']), run: () => tryBuild(s, p, 'market', spend) },
      { name: 'Mühle', utility: p.buildings.mill * CITY_MARKETS < p.buildings.market * CITY_MILLS ? 62 : 45, weight: w.economy * blockerBoost(p, ['mill', 'cities']), run: () => tryBuild(s, p, 'mill', spend) },
      { name: 'Kornspeicher', utility: ratRisk && p.buildings.granary < 3 ? 50 : 5, weight: w.economy, run: () => tryBuild(s, p, 'granary', spend) },
      { name: 'Land', utility: landUtility, weight: w.land * blockerBoost(p, ['land', 'population']), run: () => attempt(() => mut.buyLand(s, p.id, Math.floor((spend * 0.6) / s.market.landPrice))) },
      { name: 'Kathedrale', utility: p.title >= T.GRAF ? 40 : 0, weight: w.piety * blockerBoost(p, ['cathedral']), run: () => tryBuild(s, p, 'cathedral', spend) },
      { name: 'Palast', utility: p.title >= T.BARON && p.buildings.palace < 2 ? 35 : 10, weight: (w.military * 0.7 + 0.3) * blockerBoost(p, ['palace']), run: () => tryBuild(s, p, 'palace', spend) },
      // Wer ein offenes Titelziel hat, hortet nicht.
      { name: 'Sparen', utility: (hasOpenGoal ? 8 : 20) + (s.market.baseRate - 5) * 4, weight: 1, run: () => attempt(() => mut.deposit(s, p.id, Math.floor(spend * 0.3))) },
    ];
    // Etwas Zufall – Menschen sind auch nicht perfekt.
    const ranked = options
      .map((o) => ({ o, v: o.utility * o.weight * (0.85 + random(s) * 0.3) }))
      .filter((x) => x.v > 15)
      .sort((a, b) => b.v - a.v);
    let done = false;
    for (const { o } of ranked) {
      if (o.run()) {
        done = true;
        break;
      }
    }
    if (!done) return;
  }
}

/**
 * Blutgeld: Gestohlenes Gold wird sofort in greifbare Werte verwandelt – bevorzugt in das,
 * was zum nächsten Titel fehlt, sonst in Land und Städtebau.
 */
function investBloodMoney(s: GameState, p: Player, loot: number): void {
  let left = Math.min(loot, budget(p));
  for (let i = 0; i < 4 && left > 1000; i++) {
    const before = p.gold;
    const b = bottleneck(p);
    const cityType: BuildingType = p.buildings.mill * CITY_MARKETS < p.buildings.market * CITY_MILLS ? 'mill' : 'market';
    const type: BuildingType | null =
      b && (b.key === 'market' || b.key === 'mill' || b.key === 'palace' || b.key === 'cathedral') ? b.key : b?.key === 'cities' ? cityType : null;
    let ok = false;
    if (type) ok = tryBuild(s, p, type, left);
    if (!ok && b?.key !== 'land') ok = tryBuild(s, p, cityType, left);
    if (!ok) ok = attempt(() => mut.buyLand(s, p.id, Math.floor(left / s.market.landPrice)));
    if (!ok) return;
    left -= before - p.gold;
  }
}

// ------------------------------------------------------------ 4. Militär & Sabotage
/** Feindseligkeit = Groll (inkl. Neid) + Casus Belli */
export function hostility(s: GameState, p: Player): { target: Player; value: number }[] {
  const leader = [...s.players].sort((a, b) => score(b) - score(a))[0];
  return s.players
    .filter((o) => o.id !== p.id)
    .map((o) => {
      let v = p.grudges[o.id] ?? 0;
      if (o.id === leader.id && score(o) > score(p) * 1.15) v += 15;
      if (p.casusBelli.includes(o.id)) v += 40;
      return { target: o, value: v };
    })
    .sort((a, b) => b.value - a.value);
}

function militaryAndIntrigue(s: GameState, p: Player, w: Weights): void {
  const m = p.military;
  // Garde gegen Spione
  // Spione gibt es erst ab Baron – vorher reicht eine kleine Garde.
  const spiesPossible = s.players.some((o) => o.id !== p.id && o.title >= T.BARON);
  const guardTarget = spiesPossible ? Math.round((p.population / 50) * w.guard) : 10;
  if (m.guards < guardTarget) {
    const n = Math.min(guardTarget - m.guards, Math.floor((budget(p) * 0.25) / UNITS.guards.cost));
    if (n > 0) attempt(() => mut.recruit(s, p.id, 'guards', n));
  }
  // Heer zur Grenzverteidigung
  const armyTarget = Math.round((p.land / 300) * w.military);
  const army = armySize(m);
  if (army < armyTarget) {
    const useCannons = p.title >= T.BARON && w.military > 1.2;
    const unit = useCannons && m.cannons < army / 6 ? 'cannons' : 'mercenaries';
    const n = Math.min(
      unit === 'cannons' ? Math.ceil((armyTarget - army) / 4) : armyTarget - army,
      Math.floor((budget(p) * 0.3) / UNITS[unit].cost),
    );
    if (n > 0) attempt(() => mut.recruit(s, p.id, unit, n));
  }
  // Bedrohungslage: Verteidigung am stärksten (öffentlich bekannten) Rivalen ausrichten.
  // Wer uns schon einmal angegriffen hat, wird ernster genommen.
  const threat = Math.max(
    0,
    ...s.players
      .filter((o) => o.id !== p.id)
      // Wer einen Casus Belli gegen uns hat, wurde uns vom Herold genannt – mit ihm ist zu rechnen.
      .map((o) => {
        const hostile = (p.grudges[o.id] ?? 0) >= 40 || o.casusBelli.includes(p.id);
        // Ein Vertragsbruch kostet den Angreifer Skandal und Ansehen – Partner sind weniger bedrohlich.
        const peace = hasPeace(s, p.id, o.id) ? 0.4 : 1;
        return publicArmyEstimate(o) * (hostile ? 0.85 : 0.45) * (hostile ? 1 : 0.6 + 0.4 * w.military) * peace;
      }),
  );
  const myDefense = defensePower(p);
  if (myDefense < threat * 0.9) {
    const perMerc = Math.max(0.5, morale(p) * m.training * defenseBonus(p));
    const n = Math.min(Math.ceil((threat * 0.9 - myDefense) / perMerc), Math.floor((budget(p) * 0.4) / UNITS.mercenaries.cost));
    if (n > 0) attempt(() => mut.recruit(s, p.id, 'mercenaries', n));
    const hated = Object.values(p.grudges).some((g) => g >= 40) || s.players.some((o) => o.casusBelli.includes(p.id));
    if (hated && defensePower(p) < threat && chance(s, 0.5)) attempt(() => mut.setEntrenched(s, p.id, true));
  }
  if (w.military > 1.2 && !p.maneuver && maneuverCost(p) < budget(p) * 0.2) attempt(() => mut.setManeuver(s, p.id, true));
  // Ritter-Pipeline auch ohne Titeldruck für Kriegstreiber
  if (w.military > 1.2 && p.title >= T.GRAF) knightPipeline(s, p, 10, budget(p) * 0.3);

  if (s.year === s.startYear) return;
  if (opportunisticBreach(s, p)) return;
  if (p.archetype === 'raenkeschmiedin') return; // intrigiert bereits vor den Investitionen
  const enemies = hostility(s, p).filter((h) => h.value > 10);
  if (enemies.length === 0) return;

  // Angriff: Groll multipliziert die Wahrscheinlichkeit
  for (const { target, value } of enemies.slice(0, 2)) {
    let pAttack = Math.min(0.8, 0.08 * w.aggression * (1 + value / 40));
    if (hasPeace(s, p.id, target.id)) {
      // Nur der Kriegstreiber bricht sein Wort – und auch er nur aus echtem Groll.
      if (p.archetype !== 'kriegstreiber' || value < 40) continue;
      pAttack *= 0.5;
    }
    if (!chance(s, pAttack)) continue;
    // Bündnishilfe einrechnen: jeder Verbündete schickt einen Teil seines Heeres.
    const estimate = estimatedDefense(s, p, target);
    const fraction = 0.7;
    const myPower = attackPower(p, fraction, target.id);
    if (myPower > estimate * (1.3 / w.aggression) + 5) {
      if (attempt(() => mut.queueAttack(s, p.id, target.id, fraction))) break;
    }
  }

  // Taverne
  const missions: CovertMission[] = (['assassinate', 'sabotage', 'rob', 'spy'] as CovertMission[]).filter(
    (k) => p.title >= COVERT[k].minTitle,
  );
  if (missions.length === 0) return;
  // Gegen Vertragspartner wird nicht intrigiert.
  const top = enemies.find((e) => !isTreatyPartner(s, p.id, e.target.id));
  if (!top) return;
  const pCovert = Math.min(0.9, 0.12 * w.espionage * (1 + top.value / 50));
  if (!chance(s, pCovert)) return;
  const gold = Math.floor(budget(p) * 0.15 * w.espionage);
  if (gold < 300) return;
  let mission = missions[0];
  if (mission === 'assassinate' && top.value < 60) mission = missions[1] ?? 'rob';
  if (gold < estimatedCovertDefense(top.target) * 0.2 && mission !== 'spy') mission = missions[missions.length - 1];
  attempt(() => mut.queueCovert(s, p.id, top.target.id, mission, gold, chance(s, 0.5) ? 'mill' : 'grain'));
}

/** Öffentlich geschätzte Verteidigung inklusive Bündnistruppen (ohne uns selbst). */
function estimatedDefense(s: GameState, p: Player, target: Player): number {
  return (
    publicArmyEstimate(target) +
    s.players
      .filter((o) => o.id !== p.id && o.id !== target.id && treatiesBetween(s, o.id, target.id).some((t) => t.type === 'alliance'))
      .reduce((sum, o) => sum + publicArmyEstimate(o) * ALLIANCE_SHARE, 0)
  );
}

/** Ab so vielen Vertragsjahren denken Wortbrüchige über Verrat nach: das Schutzgeld ist ausgegeben. */
export const BREACH_MIN_TREATY_YEARS = 3;

/**
 * Wortbruch aus Gelegenheit: Der Kriegstreiber (und im Spätspiel die Ränkeschmiedin)
 * überfällt einen Vertragspartner, wenn der Pakt schon Jahre läuft und das Opfer
 * militärisch blank dasteht. Liefert true, wenn ein Marschbefehl erteilt wurde.
 */
function opportunisticBreach(s: GameState, p: Player): boolean {
  const profile =
    p.archetype === 'kriegstreiber'
      ? { chance: 0.2, margin: 2.0 }
      : p.archetype === 'raenkeschmiedin' && p.title >= T.HERZOG
        ? { chance: 0.3, margin: 1.5 }
        : null;
  if (!profile) return false;
  const fraction = 0.7;
  const candidates = s.players
    .filter((o) => o.id !== p.id && o.debtorPrison === 0)
    .filter((o) =>
      treatiesBetween(s, p.id, o.id).some((t) => (t.type === 'nap' || t.type === 'alliance') && s.year - t.since >= BREACH_MIN_TREATY_YEARS),
    )
    .map((o) => ({ o, ratio: attackPower(p, fraction, o.id) / Math.max(1, estimatedDefense(s, p, o)) }))
    .filter((c) => c.ratio > profile.margin)
    // Unter allen sicheren Opfern lockt die reichste Beute (höchster Punktestand).
    .sort((a, b) => score(b.o) - score(a.o));
  const victim = candidates[0];
  if (!victim || !chance(s, profile.chance)) return false;
  return attempt(() => mut.queueAttack(s, p.id, victim.o.id, fraction));
}

/**
 * Abwehr eines Ziels, geschätzt aus öffentlichen Daten (Bevölkerung, Justiz unbekannt → gerecht).
 * Die KI kennt die Gardestärke so wenig wie der Mensch.
 */
function estimatedCovertDefense(t: Player, intel?: SpyIntel): number {
  if (intel) return COVERT_BASE_DEFENSE + intel.guards * 1.1 * COVERT_DEFENSE_PER_GUARD * JUSTICE_DEFENSE[intel.justice - 1];
  const pop = publicInfo(t).population;
  // Vorsichtig schätzen: KI-Fürsten halten etwa einen Gardisten je 40 Bürger.
  return COVERT_BASE_DEFENSE + (pop / 40) * COVERT_DEFENSE_PER_GUARD * 1.2;
}

/**
 * Ziel-Scoring der Ränkeschmiedin: Grundwert + Groll, der Führende zählt ×3,5,
 * wer im Schuldturm sitzt (kein Geld, kein Einfluss) nur ×0,1. Gezogen wird
 * gewichtet – so trifft sie meist den Ersten, vergisst aber alte Rechnungen nicht.
 */
export function intrigueTargetScores(s: GameState, p: Player): { target: Player; score: number }[] {
  const rivals = s.players.filter((o) => o.id !== p.id);
  if (rivals.length === 0) return [];
  const leader = [...rivals].sort((a, b) => score(b) - score(a))[0];
  return rivals.map((o) => {
    let v = 20 + (p.grudges[o.id] ?? 0);
    if (o.id === leader.id) v *= 3.5;
    if (o.debtorPrison > 0) v *= 0.1;
    return { target: o, score: v };
  });
}

function pickIntrigueTarget(s: GameState, p: Player): Player | null {
  const scored = intrigueTargetScores(s, p);
  if (scored.length === 0) return null;
  // Schärfen (quadrieren), damit der Führende klar dominiert, ohne Ausschließlichkeit.
  const weights = scored.map((x) => x.score * x.score);
  const total = weights.reduce((a, b) => a + b, 0);
  let r = random(s) * total;
  for (let i = 0; i < scored.length; i++) {
    r -= weights[i];
    if (r <= 0) return scored[i].target;
  }
  return scored[scored.length - 1].target;
}

/**
 * Ränkeschmiedin: Gummiband gegen den Führenden. 90 % ihrer Intrigen treffen den
 * Punktbesten; Raub bevorzugt, weil die Beute als Blutgeld ihr eigenes Wachstum finanziert.
 */
function leaderIntrigue(s: GameState, p: Player, w: Weights): void {
  const rivals = s.players.filter((o) => o.id !== p.id);
  if (rivals.length === 0) return;
  const target = pickIntrigueTarget(s, p);
  if (!target) return;
  const available = (['rob', 'sabotage', 'assassinate', 'spy'] as CovertMission[]).filter((k) => p.title >= COVERT[k].minTitle);
  if (available.length === 0) return;

  const ahead = score(target) / Math.max(1, score(p));
  // Vertragspartner bespitzelt sie höchstens – es sei denn, er enteilt ihr deutlich.
  if (isTreatyPartner(s, p.id, target.id) && ahead < 1.3) return;
  // Je weiter der Führende enteilt, desto häufiger und härter wird intrigiert.
  const pCovert = Math.min(0.95, 0.35 * w.espionage * Math.max(0.5, ahead));
  if (!chance(s, pCovert)) return;

  const intel = p.intel?.[target.id];
  const fresh = intel && s.year - intel.year <= 5 ? intel : undefined;
  const defense = estimatedCovertDefense(target, fresh);
  // Wie gefährlich ist eine Enttarnung? Ein überlegenes Heer mit Casus Belli kostet Land.
  const exposureRisk = Math.min(1, publicArmyEstimate(target) / Math.max(1, defensePower(p)));
  const confess = fresh ? 0.25 + 0.1 * (fresh.justice - 1) : 0.45;

  const nearCrown = target.title >= T.KURFUERST || (s.election?.candidates.includes(target.id) ?? false);
  // Einen Gegner mit überlegenem Heer reizt sie nur, wenn er kurz vor der Krone steht.
  if (exposureRisk > 0.8 && !nearCrown) return;

  let mission: CovertMission;
  if (!fresh && available.includes('spy')) mission = 'spy'; // erst auskundschaften, dann zuschlagen
  else {
    mission = available.includes('rob') ? 'rob' : 'spy';
    if (available.includes('assassinate') && nearCrown && chance(s, 0.5)) mission = 'assassinate';
    else if (available.includes('sabotage') && ahead > 1.3 && chance(s, 0.3)) mission = 'sabotage';
  }

  // Einsatz so wählen, dass die Chance bei ~60 % liegt – mit zu wenig Gold gar nicht erst anfangen.
  const gold = Math.floor(Math.min(budget(p) * 0.4, defense * 1.5));
  if (gold < 300 || gold < defense * 0.9) return;
  const pSuccess = Math.min(COVERT[mission].maxChance, gold / (gold + defense));
  if (mission === 'rob') {
    // Erwartungswert: Beute (Anteil der Kasse + Anteil der Jahressteuern) gegen Einsatz und Rache-Risiko.
    const info = publicInfo(target);
    const cash = fresh ? fresh.gold : info.population * 4;
    const taxes = fresh ? fresh.taxIncome : info.population * 1.6 + info.buildings * 1600;
    const share = (range: readonly [number, number]) => (range[0] + range[1]) / 2;
    const expectedLoot = pSuccess * (cash * share(ROB_CASH_SHARE) + taxes * share(ROB_TAX_SHARE));
    // Enttarnung → Casus Belli → vielleicht (≈50 %) ein Rachefeldzug, den der Gegner mit ≈exposureRisk gewinnt.
    const expectedPenalty = (1 - pSuccess) * confess * 0.5 * exposureRisk * p.land * 0.15 * s.market.landPrice;
    if (ahead >= 1.1 && available.includes('sabotage')) {
      // Gegen den Führenden wird ohnehin intrigiert, Sabotage birgt dasselbe Enttarnungsrisiko.
      // Raub ist vorzuziehen, sobald die Beute einen guten Teil des Einsatzes zurückholt.
      if (expectedLoot < gold * 0.5) mission = 'sabotage';
    } else if (expectedLoot < gold + expectedPenalty) {
      return;
    }
  } else if (exposureRisk > 1.2 && mission !== 'spy' && chance(s, 0.6)) {
    return; // Gegen einen übermächtigen Gegner ist Abwarten klüger.
  }
  attempt(() => mut.queueCovert(s, p.id, target.id, mission, gold, chance(s, 0.6) ? 'mill' : 'market'));
}

// ------------------------------------------------------------ Reichstag
function electionPolitics(s: GameState, p: Player): void {
  const e = s.election;
  if (!e || !e.candidates.includes(p.id)) return;
  const share = p.archetype === 'kirchenfuerst' ? 0.8 : 0.55;
  const pot = Math.floor((p.gold + p.savings * 0.5) * share);
  if (p.savings > 0) attempt(() => mut.withdraw(s, p.id, Math.floor(p.savings * 0.5)));
  const seats = e.seats.map((seat, i) => ({ seat, i })).filter(({ seat }) => !(seat.kind === 'player' && seat.playerId === p.id));
  if (seats.length === 0 || pot <= 0) return;
  // Bischöfe sind billiger zu überzeugen als rivalisierende Kandidaten.
  const targets = seats.filter(({ seat }) => seat.kind === 'bishop' || !e.candidates.includes(seat.playerId));
  const each = Math.floor(pot / Math.max(1, targets.length));
  for (const { i } of targets) attempt(() => mut.placeBribe(s, p.id, i, each));
}

// ------------------------------------------------------------ Absicherung
function finalSafety(s: GameState, p: Player): void {
  const preview = calculateEconomyTurn(p, s.market);
  if (preview.goldAfter >= 0) {
    // Überschuss mit Zinsen schützen (Diebstahl-sicher)
    const spare = p.gold - reserve(p) - 6000;
    if (spare > 4000) attempt(() => mut.deposit(s, p.id, Math.floor(spare * 0.5)));
    return;
  }
  const deficit = -preview.goldAfter + 500;
  if (p.savings > 0) attempt(() => mut.withdraw(s, p.id, Math.min(p.savings, deficit)));
  if (calculateEconomyTurn(p, s.market).goldAfter >= 0) return;
  if (p.maneuver) attempt(() => mut.setManeuver(s, p.id, false));
  const surplusGrain = p.grain - Math.ceil((grainNeed(p) * p.ration) / 100);
  if (surplusGrain > GRAIN_TRADE_UNIT) attempt(() => mut.sellGrain(s, p.id, surplusGrain));
  if (calculateEconomyTurn(p, s.market).goldAfter >= 0) return;
  const gap = -calculateEconomyTurn(p, s.market).goldAfter + 1000;
  if (creditLimit(p, s.market) >= gap) attempt(() => mut.takeLoan(s, p.id, gap, 5));
  if (calculateEconomyTurn(p, s.market).goldAfter >= 0) return;
  // Söldner entlassen
  const merc = Math.min(p.military.mercenaries, Math.ceil(-calculateEconomyTurn(p, s.market).goldAfter / 30));
  if (merc > 0) attempt(() => mut.dismiss(s, p.id, 'mercenaries', merc));
}
