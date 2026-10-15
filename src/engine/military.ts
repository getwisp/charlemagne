import {
  ATTACK_STRENGTH,
  ATTACKER_ATTRITION,
  CASUS_BELLI_MORALE,
  DEFENSE_STRENGTH,
  ENTRENCH_BONUS,
  ENTRENCH_COST_PER_UNIT,
  GRUDGE,
  MANEUVER_COST_PER_UNIT,
  MARCH_COST_PER_UNIT,
  MIN_LAND_AFTER_BATTLE,
  PALACE_DEFENSE,
  PALACE_DEFENSE_MAX,
  TRAINING_MAX,
  TRAINING_MIN,
  WAR_DEVASTATION,
  WAR_GUILT_SCANDALS,
} from './constants';
import { builtLand, fiefLandRequired } from './economy';
import { randFloat } from './rng';
import type { AttackAction, BuildingType, GameState, Military, Player } from './types';
import { chronicle, clamp, fmt, getPlayer, tell } from './util';

type ArmyUnit = 'mercenaries' | 'cannons' | 'squires' | 'knights';
const ARMY_UNITS: ArmyUnit[] = ['mercenaries', 'cannons', 'squires', 'knights'];

/** Heer = alles außer der Garde. */
export function armySize(m: Military): number {
  return m.mercenaries + m.cannons + m.squires + m.knights;
}

export function maneuverCost(p: Player): number {
  return armySize(p.military) * MANEUVER_COST_PER_UNIT;
}

export function entrenchCost(p: Player): number {
  return armySize(p.military) * ENTRENCH_COST_PER_UNIT;
}

export function marchCost(p: Player, fraction: number, target: string): number {
  if (p.casusBelli.includes(target)) return 0;
  return Math.round(armySize(p.military) * fraction * MARCH_COST_PER_UNIT);
}

/** Moral: Hunger senkt, strenge Zucht und gerechte Sache (Casus Belli) heben sie. */
export function morale(p: Player, vsTarget?: string): number {
  let m = 1;
  if (p.ration < 100) m -= 0.25 * (1 - p.ration / 100);
  m += 0.04 * (p.justice - 3);
  if (vsTarget && p.casusBelli.includes(vsTarget)) m += CASUS_BELLI_MORALE;
  return clamp(m, 0.5, 1.5);
}

export function defenseBonus(p: Player): number {
  return 1 + Math.min(PALACE_DEFENSE_MAX, p.buildings.palace * PALACE_DEFENSE) + (p.entrenched ? ENTRENCH_BONUS : 0);
}

function rawPower(units: Record<ArmyUnit, number>, table: Record<ArmyUnit, number>): number {
  return ARMY_UNITS.reduce((sum, u) => sum + units[u] * table[u], 0);
}

function unitsOf(m: Military, fraction: number): Record<ArmyUnit, number> {
  return {
    mercenaries: Math.floor(m.mercenaries * fraction),
    cannons: Math.floor(m.cannons * fraction),
    squires: Math.floor(m.squires * fraction),
    knights: Math.floor(m.knights * fraction),
  };
}

/** Kampfkraft = Basiskraft × Moral × Ausbildungsstand (× Defensivbonus) */
export function attackPower(p: Player, fraction: number, target?: string): number {
  return rawPower(unitsOf(p.military, fraction), ATTACK_STRENGTH) * morale(p, target) * p.military.training;
}

export function defensePower(p: Player, awayFraction = 0): number {
  if (p.debtorPrison > 0) return 0; // Im Schuldturm ist das Heer führerlos.
  return rawPower(unitsOf(p.military, 1 - awayFraction), DEFENSE_STRENGTH) * morale(p) * p.military.training * defenseBonus(p);
}

function applyCasualties(m: Military, units: Record<ArmyUnit, number>, rate: number): Record<ArmyUnit, number> {
  const lost = {} as Record<ArmyUnit, number>;
  for (const u of ARMY_UNITS) {
    lost[u] = Math.round(units[u] * rate);
    m[u] = Math.max(0, m[u] - lost[u]);
  }
  return lost;
}

function lossText(lost: Record<ArmyUnit, number>): string {
  const parts: string[] = [];
  if (lost.mercenaries) parts.push(`${fmt(lost.mercenaries)} Söldner`);
  if (lost.cannons) parts.push(`${fmt(lost.cannons)} Kanonen`);
  if (lost.squires) parts.push(`${fmt(lost.squires)} Knappen`);
  if (lost.knights) parts.push(`${fmt(lost.knights)} Ritter`);
  return parts.length ? parts.join(', ') : 'keine';
}

const BUILDING_LOSS_ORDER: BuildingType[] = ['granary', 'mill', 'market', 'palace', 'cathedral'];

/** Entfernt Land; reicht freies Land nicht, gehen Gebäude verloren. */
export function loseLand(p: Player, ha: number): string[] {
  p.land = Math.max(0, p.land - ha);
  const destroyed: string[] = [];
  for (const type of BUILDING_LOSS_ORDER) {
    while (builtLand(p) > p.land && p.buildings[type] > 0) {
      p.buildings[type] -= 1;
      destroyed.push(type);
    }
  }
  return destroyed;
}

export interface BattleResult {
  attackerWon: boolean;
  attackPower: number;
  defensePower: number;
  land: number;
  gold: number;
}

export function resolveAttack(s: GameState, a: AttackAction, awayFractions: Record<string, number>): BattleResult | null {
  const att = getPlayer(s, a.from);
  const def = getPlayer(s, a.target);
  const sent = unitsOf(att.military, a.fraction);
  if (rawPower(sent, ATTACK_STRENGTH) <= 0) return null;

  const hasCb = att.casusBelli.includes(def.id);
  const aPow = attackPower(att, a.fraction, def.id) * randFloat(s, 0.85, 1.15);
  const away = awayFractions[def.id] ?? 0;
  const homeUnits = unitsOf(def.military, 1 - away);
  const dPow = defensePower(def, away) * randFloat(s, 0.85, 1.15);
  const attackerWon = aPow > dPow;
  const ratio = attackerWon ? aPow / Math.max(1, dPow) : dPow / Math.max(1, aPow);
  const severity = clamp((ratio - 1) / 1.5, 0, 1);
  const landPct = 0.1 + 0.15 * severity;
  const goldPct = 0.1 + 0.15 * severity;

  const winner = attackerWon ? att : def;
  const loser = attackerWon ? def : att;
  const winnerUnits = attackerWon ? sent : homeUnits;
  const loserUnits = attackerWon ? homeUnits : sent;
  // Der Angreifer stürmt feindliche Stellungen und blutet stärker (ATTACKER_ATTRITION).
  const winnerRate = (0.1 + 0.1 * (1 - severity)) * (attackerWon ? ATTACKER_ATTRITION : 1);
  const loserRate = Math.min(0.9, (0.3 + 0.2 * severity) * (attackerWon ? 1 : ATTACKER_ATTRITION));
  const winnerLost = applyCasualties(winner.military, winnerUnits, winnerRate);
  const loserLost = applyCasualties(loser.military, loserUnits, loserRate);

  // Verlierer büßt Land und Bargeld ein.
  const land = Math.max(0, Math.min(Math.round(loser.land * landPct), loser.land - MIN_LAND_AFTER_BATTLE));
  const gold = Math.round(Math.max(0, loser.gold) * goldPct);
  const destroyed = loseLand(loser, land);
  // Ein Teil des abgetretenen Landes ist verwüstetes Niemandsland.
  const gained = Math.round(land * (1 - WAR_DEVASTATION));
  winner.land += gained;
  loser.gold -= gold;
  winner.gold += gold;
  if (hasCb) att.casusBelli = att.casusBelli.filter((id) => id !== def.id);
  else if (WAR_GUILT_SCANDALS > 0) {
    att.scandals += WAR_GUILT_SCANDALS;
    tell(s, att.id, 'Empörung im Reich', `Euer unprovozierter Angriff auf ${def.name} empört die Kirchenfürsten (Skandal).`, 'warning');
  }

  def.grudges[att.id] = (def.grudges[att.id] ?? 0) + GRUDGE.attack;

  const destroyedText = destroyed.length ? ` Dabei gingen ${destroyed.length} Gebäude verloren.` : '';
  if (attackerWon) {
    tell(
      s,
      att.id,
      'Sieg auf dem Schlachtfeld!',
      `Euer Heer hat ${def.name} geschlagen${hasCb ? ' (gerechter Rachefeldzug)' : ''}. Beute: ${fmt(gained)} ha Land${gained < land ? ` (${fmt(land - gained)} ha sind verwüstet)` : ''} und ${fmt(gold)} Taler. Eure Verluste: ${lossText(winnerLost)}.`,
      'good',
    );
    tell(
      s,
      def.id,
      'Überfall!',
      `${att.name} hat Euer Land überfallen und gesiegt. Ihr verliert ${fmt(land)} ha Land und ${fmt(gold)} Taler.${destroyedText} Verluste: ${lossText(loserLost)}.`,
      'error',
    );
    chronicle(s, `${att.name} besiegt ${def.name} und erobert ${fmt(gained)} ha.`);
  } else {
    tell(
      s,
      att.id,
      'Niederlage!',
      `Euer Angriff auf ${def.name} ist gescheitert. Ihr verliert ${fmt(land)} ha Land und ${fmt(gold)} Taler Reparationen.${destroyedText} Verluste: ${lossText(loserLost)}.`,
      'error',
    );
    tell(
      s,
      def.id,
      'Angriff abgewehrt!',
      `${att.name} hat Euch angegriffen, doch Eure Truppen haben gesiegt. Ihr erhaltet ${fmt(gained)} ha Land und ${fmt(gold)} Taler Reparationen. Verluste: ${lossText(winnerLost)}.`,
      'good',
    );
    chronicle(s, `${def.name} schlägt den Angriff von ${att.name} zurück.`);
  }
  return { attackerWon, attackPower: aPow, defensePower: dPow, land, gold };
}

/** Jahresende: Manöver verbessern die Ausbildung, ohne Manöver verfällt sie langsam. */
export function processTraining(p: Player): void {
  const m = p.military;
  if (p.maneuver) {
    m.training = clamp(m.training + 0.2, TRAINING_MIN, TRAINING_MAX);
    if (m.squires > 0) m.squireXp = Math.min(3, m.squireXp + 1);
  } else {
    m.training = clamp(m.training - 0.05, TRAINING_MIN, TRAINING_MAX);
  }
  p.maneuver = false;
  p.entrenched = false;
}

export function hasFiefShortage(p: Player): boolean {
  return builtLand(p) + fiefLandRequired(p) > p.land;
}

