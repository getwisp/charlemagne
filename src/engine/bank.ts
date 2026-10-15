import { BUILDINGS, FORCED_LOAN_SPREAD, HECTARES_PER_BUILDING, LOAN_SPREAD } from './constants';
import { freeLand, loanPayment, savingsRate, totalDebt } from './economy';
import type { BuildingType, GameState, Loan, MarketState, Player } from './types';
import { chronicle, fmt, nextId, tell } from './util';
import { demote } from './titles';

export function annuity(principal: number, ratePct: number, years: number): number {
  const r = ratePct / 100;
  if (r === 0) return principal / years;
  return (principal * r) / (1 - Math.pow(1 + r, -years));
}

export function loanRate(p: Player, market: MarketState, assetValue: number): number {
  const leverage = assetValue > 0 ? totalDebt(p) / assetValue : 1;
  return market.baseRate + LOAN_SPREAD + (leverage > 0.3 ? 2 : 0) + (p.scandals > 2 ? 1 : 0);
}

export function createLoan(s: GameState, principal: number, rate: number, years: number, forced = false): Loan {
  return {
    id: nextId(s, 'loan'),
    principal,
    remaining: principal,
    rate,
    termYears: years,
    yearsLeft: years,
    annuity: Math.round(annuity(principal, rate, years)),
    forced,
  };
}

/** Bucht Zinsen auf das Sparkonto und zieht Kreditraten ein. */
export function processBanking(s: GameState, p: Player): { interest: number; payments: number } {
  const interest = Math.round((p.savings * savingsRate(s.market)) / 100);
  p.savings += interest;
  let payments = 0;
  for (const loan of p.loans) {
    const pay = loanPayment(loan);
    const interestPart = loan.remaining * (loan.rate / 100);
    loan.remaining = Math.max(0, loan.remaining + interestPart - pay);
    loan.yearsLeft -= 1;
    if (loan.yearsLeft <= 0) loan.remaining = 0;
    payments += pay;
  }
  payments = Math.round(payments);
  p.gold -= payments;
  const finished = p.loans.filter((l) => l.remaining <= 0.5);
  if (finished.length > 0) tell(s, p.id, 'Kredit getilgt', `${finished.length} Kredit(e) vollständig zurückgezahlt.`, 'good');
  p.loans = p.loans.filter((l) => l.remaining > 0.5);
  return { interest, payments };
}

const FORCED_SALE_ORDER: BuildingType[] = ['granary', 'market', 'mill', 'palace', 'cathedral'];
const MIN_LAND_AFTER_SALE = 1000;

/**
 * Insolvenz-Kaskade bei negativem Kassenstand:
 * 1. Pfändung des Sparkontos
 * 2. Zwangsversteigerung von Land/Gebäuden zum halben Preis
 * 3. Schuldturm (1 Runde aussetzen, Ansehensverlust, Rückstufung)
 */
export function resolveInsolvency(s: GameState, p: Player): 'ok' | 'seized' | 'auctioned' | 'prison' {
  if (p.gold >= 0) return 'ok';
  let stage: 'seized' | 'auctioned' | 'prison' = 'seized';

  // Stufe 1: Sparkonto pfänden
  const seize = Math.min(p.savings, -p.gold);
  if (seize > 0) {
    p.savings -= seize;
    p.gold += seize;
    tell(s, p.id, 'Pfändung!', `Die Bank hat ${fmt(seize)} Taler Eures Sparguthabens gepfändet, um Eure Schulden zu decken.`, 'error');
  }
  if (p.gold >= 0) return stage;

  // Stufe 2: Zwangsversteigerung zum halben Preis
  stage = 'auctioned';
  const halfLand = s.market.landPrice / 2;
  const sold: string[] = [];
  const sellableFree = Math.max(0, Math.min(freeLand(p), p.land - MIN_LAND_AFTER_SALE));
  if (sellableFree > 0) {
    const needed = Math.ceil(-p.gold / halfLand);
    const ha = Math.min(sellableFree, needed);
    p.land -= ha;
    p.gold += Math.round(ha * halfLand);
    sold.push(`${fmt(ha)} ha Land`);
  }
  for (const type of FORCED_SALE_ORDER) {
    while (p.gold < 0 && p.buildings[type] > 0 && p.land - HECTARES_PER_BUILDING >= MIN_LAND_AFTER_SALE) {
      p.buildings[type] -= 1;
      p.land -= HECTARES_PER_BUILDING;
      p.gold += Math.round(BUILDINGS[type].cost / 2 + HECTARES_PER_BUILDING * halfLand);
      sold.push(BUILDINGS[type].name);
    }
  }
  if (sold.length > 0) {
    tell(
      s,
      p.id,
      'Zwangsversteigerung',
      `Eure Gläubiger haben zum halben Preis versteigert: ${summarize(sold)}.`,
      'error',
    );
    chronicle(s, `Zwangsversteigerung bei ${p.name}.`);
  }
  if (p.gold >= 0) return stage;

  // Stufe 3: Schuldturm
  stage = 'prison';
  const rest = -p.gold;
  p.gold = 0;
  p.loans.push(createLoan(s, rest, s.market.baseRate + FORCED_LOAN_SPREAD, 5, true));
  p.debtorPrison = 1;
  p.scandals += 1;
  tell(
    s,
    p.id,
    'Schuldturm!',
    `Ihr seid bankrott. Ihr verbringt das nächste Jahr im Schuldturm: keine Kornausgabe, keine Befehle, Euer Heer ist führerlos. Die Restschuld von ${fmt(rest)} Taler wird in einen Zwangskredit umgewandelt.`,
    'error',
  );
  chronicle(s, `${p.name} wurde in den Schuldturm geworfen!`);
  demote(s, p, 'Die Schmach des Schuldturms.');
  return stage;
}

function summarize(items: string[]): string {
  const counts = new Map<string, number>();
  for (const i of items) counts.set(i, (counts.get(i) ?? 0) + 1);
  return [...counts.entries()].map(([k, v]) => (v > 1 ? `${v}× ${k}` : k)).join(', ');
}
