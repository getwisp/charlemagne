// Öffentlich bekannte (gerundete) Informationen über Rivalen.
// Menschen und KI sehen exakt dieselben Werte – genaue Zahlen gibt es nur per Spionage.

import { DEFENSE_STRENGTH, PALACE_DEFENSE, PALACE_DEFENSE_MAX } from './constants';
import { buildingCount, cityCount, score } from './economy';
import type { Player } from './types';

function roundTo(n: number, step: number): number {
  return Math.round(n / step) * step;
}

/** Geschätzte Verteidigungskraft (Heere marschieren sichtbar, Paläste sind bekannt). */
export function publicArmyEstimate(p: Player): number {
  const m = p.military;
  const raw =
    m.mercenaries * DEFENSE_STRENGTH.mercenaries +
    m.cannons * DEFENSE_STRENGTH.cannons +
    m.squires * DEFENSE_STRENGTH.squires +
    m.knights * DEFENSE_STRENGTH.knights;
  const bonus = 1 + Math.min(PALACE_DEFENSE_MAX, p.buildings.palace * PALACE_DEFENSE);
  return p.debtorPrison > 0 ? 0 : roundTo(raw * bonus, 25);
}

export interface PublicInfo {
  id: string;
  name: string;
  regentName: string;
  color: string;
  title: number;
  isAI: boolean;
  land: number;
  population: number;
  buildings: number;
  cities: number;
  cathedrals: number;
  army: number;
  score: number;
  status: string;
}

export function publicInfo(p: Player): PublicInfo {
  return {
    id: p.id,
    name: p.name,
    regentName: p.regentName,
    color: p.color,
    title: p.title,
    isAI: p.isAI,
    land: roundTo(p.land, 500),
    population: roundTo(p.population, 100),
    buildings: buildingCount(p.buildings),
    cities: cityCount(p.buildings),
    cathedrals: p.buildings.cathedral,
    army: publicArmyEstimate(p),
    score: roundTo(score(p), 100),
    status: p.debtorPrison > 0 ? 'Schuldturm' : p.sickbed > 0 ? 'Krankenbett' : '',
  };
}
