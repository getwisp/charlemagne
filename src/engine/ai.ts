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
  UNITS,
} from './constants';
import { covertChance } from './covert';
import {
  buildingUpkeep,
  calculateEconomyTurn,
  creditLimit,
  freeLand,
  grainNeed,
  loanPaymentsDue,
  militaryUpkeep,
  score,
} from './economy';
import { armySize, attackPower, defenseBonus, defensePower, maneuverCost, morale } from './military';
import { publicArmyEstimate } from './intel';
import { chance, random } from './rng';
import { nextTitleRequirements, type RequirementStatus } from './titles';
import type { Archetype, BuildingType, CovertMission, GameState, Player } from './types';
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
  const w = arch.weights;

  setPolicies(s, p, w);
  survival(s, p, arch.ration);
  speculation(s, p, w);
  titleFocus(s, p, w);
  generalInvestments(s, p, w);
  militaryAndIntrigue(s, p, w);
  electionPolitics(s, p);
  finalSafety(s, p);

  attempt(() => mut.endTurn(s, p.id));
  return s;
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
  attempt(() => mut.setJustice(s, p.id, ARCHETYPES[arch].justice));
  void w;
}

// ------------------------------------------------------------ 1. Überleben
function survival(s: GameState, p: Player, ration: number): void {
  const need = grainNeed(p);
  attempt(() => mut.setRation(s, p.id, ration));
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
  // Etwas Puffer, damit die Felder nicht völlig verschwinden.
  const farmBuffer = Math.min(p.population * HECTARES_PER_FARMER * 0.3, 1500);
  const landNeeded = HECTARES_PER_BUILDING + farmBuffer;
  const landCost = Math.max(0, landNeeded - freeLand(p)) * s.market.landPrice;
  if (def.cost + landCost > Math.min(maxSpend, budget(p))) return false;
  if (!ensureFreeLand(s, p, landNeeded, maxSpend - def.cost)) return false;
  return attempt(() => mut.build(s, p.id, type, 1));
}

function titleFocus(s: GameState, p: Player, w: Weights): void {
  // Mehrere Durchläufe: Engpass wechselt, sobald einer behoben ist.
  for (let round = 0; round < 4; round++) {
    const b = bottleneck(p);
    if (!b) return;
    const spend = budget(p) * 0.8;
    if (spend < 500) return;
    let progressed = false;
    switch (b.key) {
      case 'land': {
        const ha = Math.min(b.required - b.current + 500, Math.floor(spend / s.market.landPrice));
        if (ha > 0 && s.market.landPrice <= 30 + 10 * (w.land - 1)) progressed = attempt(() => mut.buyLand(s, p.id, ha));
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
    const farmShortage = p.population * HECTARES_PER_FARMER > freeLand(p);
    const ratRisk = p.grain > grainNeed(p) * 0.8;
    const options: Option[] = [
      { name: 'Markt', utility: 60, weight: w.economy, run: () => tryBuild(s, p, 'market', spend) },
      { name: 'Mühle', utility: p.buildings.mill * CITY_MARKETS < p.buildings.market * CITY_MILLS ? 62 : 45, weight: w.economy, run: () => tryBuild(s, p, 'mill', spend) },
      { name: 'Kornspeicher', utility: ratRisk && p.buildings.granary < 3 ? 50 : 5, weight: w.economy, run: () => tryBuild(s, p, 'granary', spend) },
      { name: 'Land', utility: farmShortage ? 55 : 20, weight: w.land, run: () => attempt(() => mut.buyLand(s, p.id, Math.floor((spend * 0.5) / s.market.landPrice))) },
      { name: 'Kathedrale', utility: p.title >= T.GRAF ? 40 : 0, weight: w.piety, run: () => tryBuild(s, p, 'cathedral', spend) },
      { name: 'Palast', utility: p.title >= T.BARON && p.buildings.palace < 2 ? 35 : 10, weight: w.military * 0.7 + 0.3, run: () => tryBuild(s, p, 'palace', spend) },
      { name: 'Sparen', utility: 20 + (s.market.baseRate - 5) * 4, weight: 1, run: () => attempt(() => mut.deposit(s, p.id, Math.floor(spend * 0.3))) },
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
      .map((o) => publicArmyEstimate(o) * ((p.grudges[o.id] ?? 0) >= 40 ? 0.8 : 0.45) * (0.6 + 0.4 * w.military)),
  );
  const myDefense = defensePower(p);
  if (myDefense < threat * 0.9) {
    const perMerc = Math.max(0.5, morale(p) * m.training * defenseBonus(p));
    const n = Math.min(Math.ceil((threat * 0.9 - myDefense) / perMerc), Math.floor((budget(p) * 0.4) / UNITS.mercenaries.cost));
    if (n > 0) attempt(() => mut.recruit(s, p.id, 'mercenaries', n));
    const hated = Object.values(p.grudges).some((g) => g >= 40);
    if (hated && defensePower(p) < threat && chance(s, 0.5)) attempt(() => mut.setEntrenched(s, p.id, true));
  }
  if (w.military > 1.2 && !p.maneuver && maneuverCost(p) < budget(p) * 0.2) attempt(() => mut.setManeuver(s, p.id, true));
  // Ritter-Pipeline auch ohne Titeldruck für Kriegstreiber
  if (w.military > 1.2 && p.title >= T.GRAF) knightPipeline(s, p, 10, budget(p) * 0.3);

  if (s.year === s.startYear) return;
  const enemies = hostility(s, p).filter((h) => h.value > 10);
  if (enemies.length === 0) return;

  // Angriff: Groll multipliziert die Wahrscheinlichkeit
  for (const { target, value } of enemies.slice(0, 2)) {
    const pAttack = Math.min(0.8, 0.08 * w.aggression * (1 + value / 40));
    if (!chance(s, pAttack)) continue;
    const estimate = publicArmyEstimate(target);
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
  const top = enemies[0];
  const pCovert = Math.min(0.9, 0.12 * w.espionage * (1 + top.value / 50));
  if (!chance(s, pCovert)) return;
  const gold = Math.floor(budget(p) * 0.15 * w.espionage);
  if (gold < 300) return;
  // Ränkeschmiedin wählt die härteste verfügbare Mission, andere eher Raub/Sabotage.
  let mission = missions[0];
  if (mission === 'assassinate' && (w.espionage < 1.5 || top.value < 60)) mission = missions[1] ?? 'rob';
  if (covertChance(gold, top.target, mission) < 0.15 && mission !== 'spy') mission = missions[missions.length - 1];
  attempt(() => mut.queueCovert(s, p.id, top.target.id, mission, gold, chance(s, 0.5) ? 'mill' : 'grain'));
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
