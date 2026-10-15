// Taverne: verdeckte Operationen. Werden in eine Warteschlange gelegt und
// erst beim Rundenwechsel ausgewertet, damit Hot-Seat-Mitspieler nicht sehen,
// wer welche Intrige gesponnen hat.

import {
  COVERT,
  COVERT_BASE_DEFENSE,
  COVERT_DEFENSE_PER_GUARD,
  GRUDGE,
  JUSTICE_DEFENSE,
  TITLES,
} from './constants';
import { cityCount, totalDebt } from './economy';
import { chance, randFloat } from './rng';
import type { CovertAction, CovertMission, GameState, Player } from './types';
import { chronicle, fmt, getPlayer, tell } from './util';
import { demote } from './titles';

/** Verteidigungswert gegen Intrigen: Garde × Justizhärte */
export function covertDefense(target: Player): number {
  return COVERT_BASE_DEFENSE + target.military.guards * COVERT_DEFENSE_PER_GUARD * JUSTICE_DEFENSE[target.justice - 1];
}

/** Erfolgschance = Gold / (Gold + Verteidigungswert), gedeckelt je Mission. */
export function covertChance(gold: number, target: Player, mission: CovertMission): number {
  const raw = gold / (gold + covertDefense(target));
  return Math.min(COVERT[mission].maxChance, raw);
}

/** Wahrscheinlichkeit, dass ein gefasster Spion unter Folter redet. */
export function confessionChance(target: Player): number {
  return 0.25 + 0.1 * (target.justice - 1);
}

const MISSION_GRUDGE: Record<CovertMission, number> = {
  spy: GRUDGE.caughtSpy,
  rob: GRUDGE.theft,
  sabotage: GRUDGE.sabotage,
  assassinate: GRUDGE.assassination,
};

const REGENT_NAMES = [
  'Friedrich', 'Wilhelm', 'Karl', 'Ludwig', 'Maximilian', 'Leopold', 'Georg', 'August',
  'Maria', 'Theresia', 'Sophie', 'Elisabeth', 'Charlotte', 'Luise', 'Amalie', 'Johann',
];

function spyReport(t: Player): string {
  return [
    `Titel: ${TITLES[t.title]} · Regent: ${t.regentName}`,
    `Gold: ${fmt(t.gold)} Taler · Sparkonto: ${fmt(t.savings)} · Schulden: ${fmt(totalDebt(t))}`,
    `Korn: ${fmt(t.grain)} Scheffel · Land: ${fmt(t.land)} ha · Bevölkerung: ${fmt(t.population)}`,
    `Märkte: ${t.buildings.market} · Mühlen: ${t.buildings.mill} · Städte: ${cityCount(t.buildings)} · Paläste: ${t.buildings.palace} · Kathedralen: ${t.buildings.cathedral}`,
    `Garde: ${fmt(t.military.guards)} · Söldner: ${fmt(t.military.mercenaries)} · Kanonen: ${fmt(t.military.cannons)} · Knappen: ${fmt(t.military.squires)} · Ritter: ${fmt(t.military.knights)}`,
    `Steuern: ${t.taxes.income}/${t.taxes.sales}/${t.taxes.tolls} % · Justiz: Stufe ${t.justice}`,
  ].join('\n');
}

export function resolveCovert(s: GameState, a: CovertAction): boolean {
  const from = getPlayer(s, a.from);
  const target = getPlayer(s, a.target);
  const p = covertChance(a.gold, target, a.mission);
  const success = chance(s, p);
  const mission = COVERT[a.mission].name;

  if (!success) {
    const talked = chance(s, confessionChance(target));
    if (talked) {
      if (!target.casusBelli.includes(from.id)) target.casusBelli.push(from.id);
      // Groll nur, wenn der Auftraggeber bekannt ist – die KI schummelt nicht.
      target.grudges[from.id] = (target.grudges[from.id] ?? 0) + MISSION_GRUDGE[a.mission];
      from.scandals += 1;
      tell(
        s,
        target.id,
        'Spion gefasst!',
        `Eure Garde hat einen Spion gefasst. Unter der Folter gestand er, im Auftrag von ${from.name} gehandelt zu haben (${mission}). Ihr habt nun einen Casus Belli gegen ${from.name}: Moralbonus und keine Marschkosten für einen Rachefeldzug.`,
        'warning',
      );
      tell(
        s,
        from.id,
        'Mission gescheitert',
        `Euer Agent (${mission} gegen ${target.name}) wurde gefasst und hat unter der Folter geredet. ${target.name} kennt nun Euren Namen – und hat einen Casus Belli.`,
        'error',
      );
      chronicle(s, `Skandal: Ein Spion von ${from.name} wurde bei ${target.name} gefasst.`);
    } else {
      tell(s, target.id, 'Spion gefasst', 'Eure Garde hat einen fremden Agenten gefasst. Er starb, ohne seinen Auftraggeber zu verraten.', 'info');
      tell(s, from.id, 'Mission gescheitert', `Euer Agent (${mission} gegen ${target.name}) wurde gefasst, schwieg aber bis zuletzt.`, 'warning');
    }
    return false;
  }

  switch (a.mission) {
    case 'spy':
      tell(s, from.id, `Spionagebericht: ${target.name}`, spyReport(target), 'info');
      (from.intel ??= {})[target.id] = {
        year: s.year,
        guards: target.military.guards,
        justice: target.justice,
        gold: Math.max(0, target.gold),
        army: target.military.mercenaries + target.military.cannons + target.military.squires + target.military.knights,
      };
      break;
    case 'rob': {
      const stolen = Math.round(Math.max(0, target.gold) * randFloat(s, 0.1, 0.25));
      target.gold -= stolen;
      from.gold += stolen;
      from.loot = (from.loot ?? 0) + stolen;
      tell(s, from.id, 'Raubzug erfolgreich', `Eure Diebe haben ${fmt(stolen)} Taler aus der Schatzkammer von ${target.name} erbeutet.`, 'good');
      tell(s, target.id, 'Raub!', `Unbekannte haben ${fmt(stolen)} Taler aus Eurer Schatzkammer gestohlen.`, 'error');
      break;
    }
    case 'sabotage': {
      const kind = a.sabotageTarget ?? 'grain';
      let text = '';
      if (kind === 'grain' || (kind === 'mill' && target.buildings.mill === 0) || (kind === 'market' && target.buildings.market === 0)) {
        const lost = Math.round(target.grain * randFloat(s, 0.3, 0.6));
        target.grain -= lost;
        text = `${fmt(lost)} Scheffel Korn verbrannt`;
      } else {
        target.buildings[kind] -= 1;
        text = kind === 'mill' ? 'eine Mühle niedergebrannt' : 'einen Markt niedergebrannt';
      }
      tell(s, from.id, 'Sabotage erfolgreich', `Eure Saboteure haben bei ${target.name} ${text}.`, 'good');
      tell(s, target.id, 'Sabotage!', `Saboteure haben ${text}. Der Auftraggeber bleibt im Dunkeln.`, 'error');
      break;
    }
    case 'assassinate': {
      const killed = chance(s, 0.5);
      if (killed) {
        const old = target.regentName;
        target.generation += 1;
        target.regentName = REGENT_NAMES[Math.floor(randFloat(s, 0, REGENT_NAMES.length))] + ' ' + romanNumeral(target.generation);
        tell(s, from.id, 'Attentat geglückt', `${old} von ${target.name} ist tot.`, 'good');
        tell(s, target.id, 'Attentat!', `${old} wurde ermordet. Euer Erbe ${target.regentName} besteigt den Thron.`, 'error');
        chronicle(s, `${old} (${target.name}) fiel einem Attentat zum Opfer.`);
        demote(s, target, 'Der Erbe muss seinen Rang erst beweisen.');
      } else {
        target.sickbed = 1;
        tell(s, from.id, 'Attentat halb geglückt', `Der Regent von ${target.name} überlebte schwer verwundet und liegt ein Jahr im Krankenbett.`, 'good');
        tell(s, target.id, 'Attentat!', 'Ein Attentäter hat Euch schwer verwundet. Ihr müsst ein Jahr das Krankenbett hüten – Eure Verwalter führen die Geschäfte unverändert fort.', 'error');
        chronicle(s, `Anschlag auf den Regenten von ${target.name}.`);
      }
      break;
    }
  }
  return true;
}

export function romanNumeral(n: number): string {
  const map: [number, string][] = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let out = '';
  for (const [v, r] of map) while (n >= v) { out += r; n -= v; }
  return out;
}
