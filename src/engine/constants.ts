import type { Archetype, BuildingType, RecruitableUnit, Weather } from './types';

export const TITLES = [
  'Edler',
  'Freiherr',
  'Baron',
  'Graf',
  'Fürst',
  'Herzog',
  'Kurfürst',
  'König',
  'Kaiser',
] as const;

export const T = {
  EDLER: 0,
  FREIHERR: 1,
  BARON: 2,
  GRAF: 3,
  FUERST: 4,
  HERZOG: 5,
  KURFUERST: 6,
  KOENIG: 7,
  KAISER: 8,
} as const;

// ---------------------------------------------------------------- Agrar
export const GRAIN_PER_CITIZEN = 2;
/** Hektar, die ein Bürger bewirtschaften kann. */
export const HECTARES_PER_FARMER = 5;
/** Scheffel je Hektar bei Ernte-Faktor 1.0 */
export const YIELD_PER_HECTARE = 0.9;
/** Korn wird in Einheiten zu 10 Scheffel gehandelt. */
export const GRAIN_TRADE_UNIT = 10;
/** Verkaufserlös relativ zum Marktpreis (Händlerspanne). */
export const SELL_SPREAD = 0.9;
export const RAT_MIN = 0.05;
export const RAT_MAX = 0.2;
/** Schutz je Kornspeicher, max. 75 %. */
export const GRANARY_PROTECTION = 0.15;
export const GRANARY_PROTECTION_MAX = 0.75;
/** Maximal tragfähige Bevölkerung je Hektar Gesamtland. */
export const POP_PER_HECTARE = 0.35;

export const WEATHER_TABLE: { weather: Weather; min: number; max: number }[] = [
  { weather: 'Dürre', min: 0.4, max: 0.6 },
  { weather: 'Missernte', min: 0.6, max: 0.85 },
  { weather: 'Mäßig', min: 0.85, max: 0.98 },
  { weather: 'Normal', min: 0.98, max: 1.15 },
  { weather: 'Gut', min: 1.15, max: 1.4 },
  { weather: 'Prächtig', min: 1.4, max: 1.6 },
];
/** Gewichtung der Wetterlagen (Glockenkurve). */
export const WEATHER_WEIGHTS = [1, 2, 3, 4, 3, 1];

export const GRAIN_PRICE_MIN = 5;
export const GRAIN_PRICE_MAX = 50;
export const LAND_PRICE_MIN = 8;
export const LAND_PRICE_MAX = 40;

// ---------------------------------------------------------------- Bauen
export const HECTARES_PER_BUILDING = 1000;

export const BUILDINGS: Record<
  BuildingType,
  { name: string; plural: string; cost: number; upkeep: number; minTitle: number; description: string }
> = {
  market: {
    name: 'Markt',
    plural: 'Märkte',
    cost: 3000,
    upkeep: 0,
    minTitle: 0,
    description: 'Bringt Handelsvolumen für Mehrwertsteuer und Zölle.',
  },
  mill: {
    name: 'Mühle',
    plural: 'Mühlen',
    cost: 4000,
    upkeep: 0,
    minTitle: 0,
    description: 'Mahlt Korn – Umsatz für die Mehrwertsteuer.',
  },
  granary: {
    name: 'Kornspeicher',
    plural: 'Kornspeicher',
    cost: 1500,
    upkeep: 0,
    minTitle: 0,
    description: 'Schützt je 15 % des Lagers vor Rattenfraß (max. 75 %).',
  },
  palace: {
    name: 'Palast',
    plural: 'Paläste',
    cost: 8000,
    upkeep: 300,
    minTitle: 2,
    description: 'Prestige und +10 % Verteidigung je Palast (max. +50 %).',
  },
  cathedral: {
    name: 'Kathedrale',
    plural: 'Kathedralen',
    cost: 20000,
    upkeep: 500,
    minTitle: 3,
    description: 'Frömmigkeit, Pilger und Stimmen der Kirchenfürsten.',
  },
};

/** Stadt-Formel: 5 Märkte + 3 Mühlen = 1 Stadt (abgeleiteter Zustand). */
export const CITY_MARKETS = 5;
export const CITY_MILLS = 3;
export const CITY_TAX_BONUS = 0.1;
/**
 * Verwaltungsaufwand großer Reiche: Die ersten drei Städte bringen je +10 % auf alle Steuern,
 * jede weitere nur noch +5 %.
 */
export const CITY_BONUS_FULL_CITIES = 3;
export const CITY_TAX_BONUS_LATE = 0.05;

// ---------------------------------------------------------------- Steuern
export const TAX_LIMITS = { income: 50, sales: 30, tolls: 30 } as const;
export const DEFAULT_TAXES = { income: 20, sales: 10, tolls: 10 } as const;
export const INCOME_PER_CITIZEN = 6;
/**
 * Sanfte Steuerkurve, Teil 1 – Handel weicht aus: Das Volumen für Mehrwertsteuer und Zölle
 * schrumpft quadratisch mit dem Steuersatz. Beim Referenzsatz bleibt es unverändert, darunter
 * belebt sich der Handel, darüber kostet jeder Punkt mehr. Ertragsmaximum bei
 * 1/√(3·TRADE_EVASION) ≈ 11 %.
 */
export const TRADE_EVASION = 27.5;
export const TRADE_TAX_REFERENCE = 0.1;
/** Teil 2 – Einkommensteuer: jährliche Abwanderung = Bevölkerung × Faktor × Satz² (ab dem ersten Prozentpunkt). */
export const INCOME_TAX_EMIGRATION = 0.12;
export const SALES_PER_CITIZEN = 4;
export const SALES_PER_MARKET = 15000;
export const SALES_PER_MILL = 10000;
export const TOLLS_PER_MARKET = 6000;
export const TOLLS_PER_HECTARE = 0.3;

export const JUSTICE_NAMES = ['Mild', 'Nachsichtig', 'Gerecht', 'Streng', 'Drakonisch'];
/** Steuerausfall durch Kriminalität je Justizstufe */
export const JUSTICE_CRIME = [0.2, 0.12, 0.06, 0.03, 0.01];
/** Abwanderung durch Willkür je Justizstufe (Anteil der Bevölkerung) */
export const JUSTICE_EMIGRATION = [0, 0, 0.003, 0.01, 0.02];
/** Faktor der Gardeabwehr gegen Spione */
export const JUSTICE_DEFENSE = [0.6, 0.8, 1.0, 1.2, 1.4];
/**
 * Pilger: Gold je 1.000 Einwohner und Jahr, multipliziert mit dem Kirchenfaktor
 * (Kathedralen + Paläste + Bonus für milde Justiz). Pilger wohnen in Herbergen
 * um die Kathedralen – sie blockieren kein Ackerland und essen kein eigenes Korn.
 */
export const PILGRIM_BASE = 200;
export const PILGRIM_PER_CATHEDRAL = 1;
export const PILGRIM_PER_PALACE = 0.2;
/** Pilger fühlen sich unter milder Justiz sicher (Stufe 1–5). */
export const PILGRIM_JUSTICE_BONUS = [0.6, 0.4, 0, 0, 0];
/** Frömmigkeit je Justizstufe */
export const JUSTICE_PIETY = [3, 2, 1, 0, -1];

// ---------------------------------------------------------------- Militär
export const UNITS: Record<
  RecruitableUnit | 'knights',
  { name: string; plural: string; cost: number; upkeep: number; minTitle: number; fromPopulation: boolean }
> = {
  guards: { name: 'Gardist', plural: 'Garde', cost: 50, upkeep: 25, minTitle: 0, fromPopulation: true },
  mercenaries: { name: 'Söldner', plural: 'Söldner', cost: 80, upkeep: 30, minTitle: 0, fromPopulation: false },
  cannons: { name: 'Kanone', plural: 'Kanonen', cost: 400, upkeep: 80, minTitle: 2, fromPopulation: false },
  squires: { name: 'Knappe', plural: 'Knappen', cost: 120, upkeep: 20, minTitle: 1, fromPopulation: true },
  knights: { name: 'Ritter', plural: 'Ritter', cost: 300, upkeep: 0, minTitle: 3, fromPopulation: false },
};

export const ATTACK_STRENGTH = { mercenaries: 1, cannons: 3, squires: 1.2, knights: 5 } as const;
export const DEFENSE_STRENGTH = { mercenaries: 1, cannons: 4, squires: 1.2, knights: 5 } as const;

export const FIEF_HECTARES = 50;
export const KNIGHT_MIN_XP = 2;
export const LANDLESS_KNIGHT_PAY = 150;
export const MANEUVER_COST_PER_UNIT = 15;
export const ENTRENCH_COST_PER_UNIT = 5;
export const MARCH_COST_PER_UNIT = 10;
export const TRAINING_MIN = 0.8;
export const TRAINING_MAX = 1.5;
export const PALACE_DEFENSE = 0.1;
export const PALACE_DEFENSE_MAX = 0.5;
export const ENTRENCH_BONUS = 0.25;
export const CASUS_BELLI_MORALE = 0.25;
/** Land, das einem Verlierer nach einer Schlacht mindestens bleibt (Reichsfrieden). */
export const MIN_LAND_AFTER_BATTLE = 5000;

// ---------------------------------------------------------------- Bank
export const BASE_RATE_MIN = 2;
export const BASE_RATE_MAX = 10;
export const LOAN_TERMS = [3, 5, 10];
export const LOAN_SPREAD = 3;
export const EARLY_REPAYMENT_FEE = 0.02;
export const FORCED_LOAN_SPREAD = 8;

// ---------------------------------------------------------------- Taverne
export const COVERT: Record<
  'spy' | 'rob' | 'sabotage' | 'assassinate',
  { name: string; minTitle: number; description: string; maxChance: number }
> = {
  spy: { name: 'Ausspähen', minTitle: 2, description: 'Zeigt die exakten Werte des Ziels.', maxChance: 0.95 },
  rob: {
    name: 'Raub',
    minTitle: 3,
    description: 'Stiehlt 10–25 % des Bargelds und fängt 10–20 % der Steuereinnahmen des Jahres ab.',
    maxChance: 0.9,
  },
  sabotage: {
    name: 'Sabotage',
    minTitle: 4,
    description: 'Zerstört eine Mühle, einen Markt oder 30–60 % des Korns.',
    maxChance: 0.85,
  },
  assassinate: {
    name: 'Attentat',
    minTitle: 5,
    description: 'Max. 25 % Chance. Tötet den Regenten oder zwingt ihn ins Krankenbett.',
    maxChance: 0.25,
  },
};
export const COVERT_BASE_DEFENSE = 100;
export const COVERT_DEFENSE_PER_GUARD = 15;
export const COVERT_MIN_GOLD = 100;
/** Raub: Anteil des Bargelds in der Schatzkammer */
export const ROB_CASH_SHARE = [0.1, 0.25] as const;
/**
 * Steuereintreiber-Raub: Anteil der laufenden Steuereinnahmen, den die Diebe abfangen,
 * bevor das Geld in Schatzkammer oder Bank verbucht wird. Das Sparkonto bleibt unangetastet.
 */
export const ROB_TAX_SHARE = [0.1, 0.2] as const;

// ---------------------------------------------------------------- Titel
export interface TitleRequirements {
  land?: number;
  population?: number;
  market?: number;
  mill?: number;
  palace?: number;
  cathedral?: number;
  cities?: number;
  knights?: number;
  gold?: number;
}

/** Voraussetzungen für den Titel mit dem jeweiligen Index (Index 0 = Startitel). */
export const TITLE_REQUIREMENTS: TitleRequirements[] = [
  {},
  { land: 12000, population: 2500, market: 1 },
  { land: 15000, population: 3000, market: 2, mill: 1 },
  { land: 19000, population: 3800, market: 3, mill: 2, palace: 1 },
  { land: 24000, population: 5000, market: 5, mill: 3, palace: 1 },
  { land: 30000, population: 6500, cities: 1, palace: 2, knights: 10 },
  { land: 37000, population: 8000, cities: 1, palace: 3, knights: 20, cathedral: 1 },
  { land: 45000, population: 10000, market: 8, mill: 5, palace: 4, knights: 30, cathedral: 1 },
  {},
];

export const REQUIREMENT_LABELS: Record<keyof TitleRequirements, string> = {
  land: 'Land (ha)',
  population: 'Bevölkerung',
  market: 'Märkte',
  mill: 'Mühlen',
  palace: 'Paläste',
  cathedral: 'Kathedralen',
  cities: 'Städte',
  knights: 'Ritter',
  gold: 'Staatsschatz',
};

// ---------------------------------------------------------------- Reichstag
export const ELECTION_SEATS = 7;
export const ELECTION_MAJORITY = 4;
export const BISHOP_CATHEDRAL_BONUS = 4000;
export const BISHOP_PIETY_BONUS = 500;
export const BISHOP_SCANDAL_MALUS = 3000;
/** Unter diesem Wert enthält sich ein Kirchenfürst (Grundpreis seiner Stimme). */
export const BISHOP_MIN_SCORE = 15000;
export const BISHOP_NAMES = [
  'Erzbischof von Mainz',
  'Erzbischof von Köln',
  'Erzbischof von Trier',
  'Fürstbischof von Würzburg',
  'Fürstbischof von Bamberg',
  'Fürstbischof von Salzburg',
  'Fürstabt von Fulda',
];

// ---------------------------------------------------------------- KI
export const ARCHETYPES: Record<
  Archetype,
  {
    name: string;
    description: string;
    weights: {
      economy: number;
      land: number;
      military: number;
      guard: number;
      espionage: number;
      piety: number;
      aggression: number;
      speculation: number;
    };
    justice: number;
    ration: number;
  }
> = {
  pfeffersack: {
    name: 'Pfeffersack',
    description: 'Fokus auf Städtebau und Handelsspekulation.',
    weights: { economy: 1.5, land: 1.1, military: 0.6, guard: 0.9, espionage: 0.5, piety: 0.7, aggression: 0.3, speculation: 1.5 },
    justice: 3,
    ration: 105,
  },
  kriegstreiber: {
    name: 'Kriegstreiber',
    description: 'Fokus auf Militär, harte Justiz, schnelle Angriffe.',
    weights: { economy: 0.9, land: 1.0, military: 1.6, guard: 0.8, espionage: 0.6, piety: 0.4, aggression: 1.6, speculation: 0.7 },
    justice: 4,
    ration: 100,
  },
  raenkeschmiedin: {
    name: 'Ränkeschmiedin',
    description: 'Fokus auf Spionage, bricht Verträge.',
    weights: { economy: 1.0, land: 1.0, military: 0.8, guard: 1.0, espionage: 1.7, piety: 0.6, aggression: 0.8, speculation: 1.0 },
    justice: 3,
    ration: 100,
  },
  kirchenfuerst: {
    name: 'Kirchenfürst',
    description: 'Fokus auf Wachstum, Kathedralen, Kurfürsten-Bestechung.',
    weights: { economy: 1.0, land: 1.1, military: 0.6, guard: 1.0, espionage: 0.3, piety: 1.7, aggression: 0.3, speculation: 0.9 },
    justice: 2,
    ration: 110,
  },
};

export const GRUDGE = {
  theft: 35,
  attack: 50,
  sabotage: 40,
  assassination: 60,
  caughtSpy: 30,
  decay: 0.85,
  envy: 25,
} as const;

export const PLAYER_COLORS = [
  '#000080',
  '#800000',
  '#008000',
  '#808000',
  '#800080',
  '#008080',
  '#c06000',
  '#404040',
  '#0000ff',
];

export const START_VALUES = {
  year: 1700,
  gold: 15000,
  grain: 6000,
  land: 10000,
  population: 2000,
  guards: 10,
  mercenaries: 20,
};
