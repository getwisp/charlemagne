// Reine Berechnungsfunktionen der Wirtschaft. Keine Seiteneffekte, kein RNG:
// dieselben Funktionen speisen die Live-Vorschau im UI und die Jahresabrechnung.

import {
  BUILDINGS,
  CITY_MARKETS,
  CITY_MILLS,
  CITIZENS_PER_TRADE_BUILDING,
  CITY_BONUS_CAP,
  CITY_BONUS_FULL_CITIES,
  CITY_BONUS_TRADE_ONLY,
  CITY_TAX_BONUS,
  CITY_TAX_BONUS_LATE,
  FIEF_HECTARES,
  GRAIN_PER_CITIZEN,
  GRANARY_PROTECTION,
  GRANARY_PROTECTION_MAX,
  HECTARES_PER_BUILDING,
  HECTARES_PER_FARMER,
  INCOME_PER_CITIZEN,
  INCOME_TAX_EMIGRATION,
  JUSTICE_CRIME,
  JUSTICE_EMIGRATION,
  JUSTICE_PIETY,
  PILGRIM_BASE,
  PILGRIM_JUSTICE_BONUS,
  PILGRIM_PER_CATHEDRAL,
  PILGRIM_PER_PALACE,
  LANDLESS_KNIGHT_PAY,
  POP_PER_HECTARE,
  RAT_MAX,
  RAT_MIN,
  SALES_PER_CITIZEN,
  SALES_PER_MARKET,
  SALES_PER_MILL,
  TOLLS_PER_HECTARE,
  TOLLS_PER_MARKET,
  TRADE_EVASION,
  TRADE_TAX_REFERENCE,
  UNITS,
  YIELD_PER_HECTARE,
} from './constants';
import type { BuildingType, Buildings, Loan, MarketState, Player, YearReport } from './types';

export function buildingCount(b: Buildings): number {
  return (Object.keys(b) as BuildingType[]).reduce((sum, k) => sum + b[k], 0);
}

/** Städte sind ein abgeleiteter Zustand: 5 Märkte + 3 Mühlen = 1 Stadt. */
export function cityCount(b: Buildings): number {
  return Math.min(Math.floor(b.market / CITY_MARKETS), Math.floor(b.mill / CITY_MILLS));
}

export function builtLand(p: Pick<Player, 'buildings'>): number {
  return buildingCount(p.buildings) * HECTARES_PER_BUILDING;
}

export function fiefLandRequired(p: Pick<Player, 'military'>): number {
  return p.military.knights * FIEF_HECTARES;
}

/** Tatsächlich als Lehen vergebenes Land (kann bei Landmangel kleiner sein als der Bedarf). */
export function fiefLand(p: Pick<Player, 'military' | 'buildings' | 'land'>): number {
  return Math.min(fiefLandRequired(p), Math.max(0, p.land - builtLand(p)));
}

export function landlessKnights(p: Pick<Player, 'military' | 'buildings' | 'land'>): number {
  const available = Math.max(0, p.land - builtLand(p));
  return Math.max(0, p.military.knights - Math.floor(available / FIEF_HECTARES));
}

/** Gesamtland = bebautes Land + Lehnsland + freies Ackerland */
export function freeLand(p: Pick<Player, 'military' | 'buildings' | 'land'>): number {
  return Math.max(0, p.land - builtLand(p) - fiefLandRequired(p));
}

export function grainNeed(p: Pick<Player, 'population'>): number {
  return p.population * GRAIN_PER_CITIZEN;
}

export function expectedHarvest(p: Pick<Player, 'military' | 'buildings' | 'land' | 'population'>, harvestFactor: number): number {
  const farmed = Math.min(freeLand(p), p.population * HECTARES_PER_FARMER);
  return Math.round(farmed * YIELD_PER_HECTARE * harvestFactor);
}

export function granaryProtection(b: Buildings): number {
  return Math.min(GRANARY_PROTECTION_MAX, b.granary * GRANARY_PROTECTION);
}

export function militaryUpkeep(p: Pick<Player, 'military'>): number {
  const m = p.military;
  return (
    m.guards * UNITS.guards.upkeep +
    m.mercenaries * UNITS.mercenaries.upkeep +
    m.cannons * UNITS.cannons.upkeep +
    m.squires * UNITS.squires.upkeep
  );
}

export function buildingUpkeep(b: Buildings): number {
  return (Object.keys(b) as BuildingType[]).reduce((sum, k) => sum + b[k] * BUILDINGS[k].upkeep, 0);
}

export function piety(p: Pick<Player, 'buildings' | 'justice' | 'scandals'>): number {
  return p.buildings.cathedral * 5 + JUSTICE_PIETY[p.justice - 1] - p.scandals;
}

export function totalDebt(p: Pick<Player, 'loans'>): number {
  return p.loans.reduce((sum, l) => sum + l.remaining, 0);
}

/** Fällige Jahresrate eines Kredits (Annuität, in der letzten Periode ggf. weniger). */
export function loanPayment(l: Loan): number {
  return Math.min(l.annuity, l.remaining * (1 + l.rate / 100));
}

export function loanPaymentsDue(p: Pick<Player, 'loans'>): number {
  return p.loans.reduce((sum, l) => sum + loanPayment(l), 0);
}

/** Sparzins = halber Leitzins (mind. 1 %), damit Guthaben nicht exponentiell explodieren. */
export function savingsRate(market: MarketState): number {
  return Math.max(1, Math.round(market.baseRate / 2));
}

export interface TaxBreakdown {
  incomeTax: number;
  salesTax: number;
  tolls: number;
  cityBonus: number;
  crimeLoss: number;
  total: number;
}

/** Kirchenfaktor für Pilger: Kathedralen, Paläste und milde Justiz. */
export function churchFactor(p: Pick<Player, 'buildings' | 'justice'>): number {
  return (
    p.buildings.cathedral * PILGRIM_PER_CATHEDRAL +
    p.buildings.palace * PILGRIM_PER_PALACE +
    PILGRIM_JUSTICE_BONUS[p.justice - 1]
  );
}

/** Pilger-Einnahmen = (Bevölkerung / 1.000) × Basissatz × Kirchenfaktor */
export function pilgrimIncome(p: Pick<Player, 'population' | 'buildings' | 'justice'>): number {
  return Math.round((p.population / 1000) * PILGRIM_BASE * churchFactor(p));
}

/** Anteil des Handelsvolumens, der bei diesem Satz im Land bleibt (1 beim Referenzsatz). */
export function tradeRetention(ratePct: number): number {
  const t = ratePct / 100;
  return Math.max(0, 1 - TRADE_EVASION * (t * t - TRADE_TAX_REFERENCE * TRADE_TAX_REFERENCE));
}

/** Stadt-Bonus als Faktor (0,1 = +10 %), je nach Bonus-Modell. */
export function cityBonusFactor(b: Buildings): number {
  let f = 0;
  for (let k = 1; k <= cityCount(b); k++) f += k <= CITY_BONUS_FULL_CITIES ? CITY_TAX_BONUS : CITY_TAX_BONUS_LATE;
  return Math.min(CITY_BONUS_CAP, f);
}

/** Auslastung von Märkten und Mühlen: ohne genug Einwohner bleiben Stände leer (Geisterstädte). */
export function tradeStaffing(p: Pick<Player, 'population' | 'buildings'>): number {
  const n = p.buildings.market + p.buildings.mill;
  if (CITIZENS_PER_TRADE_BUILDING <= 0 || n === 0) return 1;
  return Math.min(1, p.population / (n * CITIZENS_PER_TRADE_BUILDING));
}

export function calculateTaxes(p: Pick<Player, 'population' | 'buildings' | 'land' | 'taxes' | 'justice'>): TaxBreakdown {
  const incomeTax = p.population * INCOME_PER_CITIZEN * (p.taxes.income / 100);
  const staffing = tradeStaffing(p);
  const salesVolume =
    p.population * SALES_PER_CITIZEN + (p.buildings.market * SALES_PER_MARKET + p.buildings.mill * SALES_PER_MILL) * staffing;
  const salesTax = salesVolume * tradeRetention(p.taxes.sales) * (p.taxes.sales / 100);
  const tollVolume = p.buildings.market * TOLLS_PER_MARKET * staffing + p.land * TOLLS_PER_HECTARE;
  const tolls = tollVolume * tradeRetention(p.taxes.tolls) * (p.taxes.tolls / 100);
  const gross = incomeTax + salesTax + tolls;
  const cityBonus = (CITY_BONUS_TRADE_ONLY ? salesTax + tolls : gross) * cityBonusFactor(p.buildings);
  const crimeLoss = (gross + cityBonus) * JUSTICE_CRIME[p.justice - 1];
  return {
    incomeTax: Math.round(incomeTax),
    salesTax: Math.round(salesTax),
    tolls: Math.round(tolls),
    cityBonus: Math.round(cityBonus),
    crimeLoss: Math.round(crimeLoss),
    total: Math.round(gross + cityBonus - crimeLoss),
  };
}

export interface PopulationChange {
  births: number;
  deaths: number;
  starved: number;
  immigrants: number;
  emigrants: number;
  net: number;
}

export function calculatePopulation(
  p: Pick<Player, 'population' | 'taxes' | 'justice' | 'land'>,
  grainDistributed: number,
): PopulationChange {
  const pop = p.population;
  const need = pop * GRAIN_PER_CITIZEN;
  const ratio = need > 0 ? grainDistributed / need : 1;
  const births = pop * 0.04;
  const deaths = pop * 0.025;
  let starved = 0;
  let immigrants = 0;
  let emigrants = 0;
  if (ratio < 1) {
    starved = pop * (1 - ratio) * 0.25;
    emigrants += pop * (1 - ratio) * 0.15;
  } else {
    immigrants = pop * Math.min(ratio - 1, 1) * 0.12;
  }
  // Steuerdruck: jeder Prozentpunkt Einkommensteuer kostet Einwohner, steigend (keine Freizone).
  // Mehrwertsteuer und Zölle wirken über das ausweichende Handelsvolumen (tradeRetention).
  emigrants += pop * INCOME_TAX_EMIGRATION * (p.taxes.income / 100) ** 2;
  // Willkürjustiz
  emigrants += pop * JUSTICE_EMIGRATION[p.justice - 1];
  // Überbevölkerung
  const capacity = p.land * POP_PER_HECTARE;
  const projected = pop + births - deaths - starved + immigrants - emigrants;
  if (projected > capacity) emigrants += (projected - capacity) * 0.5;

  const r = {
    births: Math.round(births),
    deaths: Math.round(deaths),
    starved: Math.round(starved),
    immigrants: Math.round(immigrants),
    emigrants: Math.round(emigrants),
    net: 0,
  };
  r.net = r.births - r.deaths - r.starved + r.immigrants - r.emigrants;
  if (pop + r.net < 0) r.net = -pop;
  return r;
}

export interface EconomyPreview extends YearReport {
  grainAfter: number;
  goldAfter: number;
  populationAfter: number;
  landlessKnights: number;
  taxes: TaxBreakdown;
}

export interface EconomyOptions {
  /** Rattenfraß-Quote vor Kornspeicher-Schutz. Default = Erwartungswert. */
  ratRate?: number;
  /** Erzwingt eine andere Kornausgabe (z. B. 0 im Schuldturm). */
  rationOverride?: number;
}

/**
 * Berechnet die Jahresabrechnung eines Spielers rein funktional.
 * Wird als Was-wäre-wenn-Vorschau im UI und als Grundlage der echten Abrechnung genutzt.
 */
export function calculateEconomyTurn(p: Player, market: MarketState, opts: EconomyOptions = {}): EconomyPreview {
  const ration = opts.rationOverride ?? p.ration;
  const need = grainNeed(p);
  const grainDistributed = Math.round(Math.min(p.grain, (need * ration) / 100));
  const pop = calculatePopulation(p, grainDistributed);

  const taxes = calculateTaxes(p);
  const savingsInterest = Math.round((p.savings * savingsRate(market)) / 100);
  const mUpkeep = militaryUpkeep(p);
  const bUpkeep = buildingUpkeep(p.buildings);
  const loanPayments = Math.round(loanPaymentsDue(p));

  // Landlose Ritter fordern Strafsold oder desertieren.
  const landless = landlessKnights(p);
  const pilgrims = pilgrimIncome(p);
  const goldBeforeKnights = p.gold + taxes.total + pilgrims - mUpkeep - bUpkeep - loanPayments;
  let landlessPay = 0;
  let deserted = 0;
  if (landless > 0) {
    const affordable = Math.max(0, Math.floor(goldBeforeKnights / LANDLESS_KNIGHT_PAY));
    const paid = Math.min(landless, affordable);
    landlessPay = paid * LANDLESS_KNIGHT_PAY;
    deserted = landless - paid;
  }

  const ratRate = opts.ratRate ?? (RAT_MIN + RAT_MAX) / 2;
  const stored = p.grain - grainDistributed;
  const ratLoss = Math.round(stored * ratRate * (1 - granaryProtection(p.buildings)));

  // Sparzinsen werden dem Sparkonto gutgeschrieben, nicht der Kasse.
  const netGold = taxes.total + pilgrims - mUpkeep - bUpkeep - loanPayments - landlessPay;

  return {
    year: 0,
    harvest: p.harvestThisYear,
    grainDistributed,
    ratLoss,
    births: pop.births,
    deaths: pop.deaths,
    starved: pop.starved,
    immigrants: pop.immigrants,
    emigrants: pop.emigrants,
    taxIncome: taxes.total,
    taxIntercepted: 0,
    pilgrimIncome: pilgrims,
    incomeTax: taxes.incomeTax,
    salesTax: taxes.salesTax,
    tolls: taxes.tolls,
    savingsInterest,
    militaryUpkeep: mUpkeep,
    buildingUpkeep: bUpkeep,
    loanPayments,
    landlessKnightPay: landlessPay,
    desertedKnights: deserted,
    netGold,
    grainAfter: stored - ratLoss,
    goldAfter: p.gold + netGold,
    populationAfter: p.population + pop.net,
    landlessKnights: landless,
    taxes,
  };
}

/** Grober Vermögenswert für Kreditrahmen und Ranglisten. */
export function assetValue(p: Player, market: MarketState): number {
  const buildingValue = (Object.keys(p.buildings) as BuildingType[]).reduce(
    (sum, k) => sum + p.buildings[k] * BUILDINGS[k].cost,
    0,
  );
  return p.land * market.landPrice + buildingValue + p.gold + p.savings + (p.grain / 10) * market.grainPrice;
}

export function creditLimit(p: Player, market: MarketState): number {
  const buildingValue = (Object.keys(p.buildings) as BuildingType[]).reduce(
    (sum, k) => sum + p.buildings[k] * BUILDINGS[k].cost,
    0,
  );
  const collateral = p.land * market.landPrice * 0.4 + buildingValue * 0.4 + p.savings * 0.5;
  return Math.max(0, Math.round(collateral - totalDebt(p)));
}

/** Punktestand für Rangliste und Neid-Faktor der KI. */
export function score(p: Player): number {
  return Math.round(
    p.title * 10000 +
      p.land / 10 +
      p.population / 5 +
      buildingCount(p.buildings) * 200 +
      p.buildings.cathedral * 1000 +
      (p.gold + p.savings - totalDebt(p)) / 50,
  );
}
