// Die State-Machine des Jahreslaufs:
//   beginYear  → Wetter, Marktpreise, Ernte, Zufallsereignisse
//   (Dashboard-Phase: Spieler geben Befehle, KI plant ihren Zug)
//   resolveYear → Intrigen, Kriege, Reichstag, Wirtschaft, Bank, Titel → beginYear

import { ARCHETYPES, DEFAULT_TAXES, GRUDGE, PLAYER_COLORS, RAT_MAX, RAT_MIN, SCANDAL_DECAY_YEARS, START_VALUES, TITLES } from './constants';
import { calculateEconomyTurn, expectedHarvest, grainNeed, score } from './economy';
import { processBanking, resolveInsolvency } from './bank';
import { resolveCovert } from './covert';
import { expireTreaties, processOffers, tradeAgreementCount } from './diplomacy';
import { drawEvent, freshEventBag } from './events';
import { maybeCallElection, resolveElection } from './election';
import { processTraining, resolveAttack } from './military';
import { randFloat, shuffle } from './rng';
import { checkTitles } from './titles';
import type { Archetype, AttackAction, CovertAction, GameSettings, GameState, Player } from './types';
import { chronicle, clone, fmt, getPlayer, tell } from './util';
import { rollMarket } from './world';

export const SAVE_VERSION = 1;

export interface PlayerSetup {
  name: string;
  isAI: boolean;
  archetype?: Archetype;
}

export interface NewGameOptions {
  players: PlayerSetup[];
  seed?: number;
  endYear?: number;
  settings?: Partial<GameSettings>;
}

function createPlayer(setup: PlayerSetup, index: number): Player {
  const archetype = setup.isAI ? setup.archetype ?? 'pfeffersack' : null;
  return {
    id: `p${index + 1}`,
    name: setup.name,
    regentName: setup.name,
    generation: 1,
    color: PLAYER_COLORS[index % PLAYER_COLORS.length],
    isAI: setup.isAI,
    archetype,
    title: 0,
    gold: START_VALUES.gold,
    grain: START_VALUES.grain,
    land: START_VALUES.land,
    population: START_VALUES.population,
    buildings: { market: 0, mill: 0, granary: 0, palace: 0, cathedral: 0 },
    military: {
      guards: START_VALUES.guards,
      mercenaries: START_VALUES.mercenaries,
      cannons: 0,
      squires: 0,
      squireXp: 0,
      knights: 0,
      training: 1,
    },
    taxes: { ...DEFAULT_TAXES },
    justice: archetype ? ARCHETYPES[archetype].justice : 3,
    ration: 100,
    savings: 0,
    loans: [],
    debtorPrison: 0,
    sickbed: 0,
    maneuver: false,
    entrenched: false,
    casusBelli: [],
    grudges: {},
    scandals: 0,
    landAtYearStart: START_VALUES.land,
    lastPromotionYear: 0,
    history: [],
    lastReport: null,
    harvestThisYear: 0,
    loot: 0,
    turnDone: false,
  };
}

export function newGame(opts: NewGameOptions): GameState {
  if (opts.players.length < 1 || opts.players.length > 9) throw new Error('1 bis 9 Spieler erlaubt.');
  const seed = opts.seed ?? Math.floor(Math.random() * 2 ** 31);
  const s: GameState = {
    version: SAVE_VERSION,
    id: `g${seed.toString(36)}`,
    seed,
    rng: seed,
    year: START_VALUES.year,
    startYear: START_VALUES.year,
    phase: 'orders',
    players: opts.players.map(createPlayer),
    market: { weather: 'Normal', harvestFactor: 1, grainPrice: 25, landPrice: 24, baseRate: 5 },
    queue: [],
    eventBag: [],
    messages: {},
    chronicle: [],
    election: null,
    treaties: [],
    offers: [],
    lastElection: null,
    winnerId: null,
    endReason: null,
    settings: {
      endYear: opts.endYear ?? 1800,
      aiDelayMin: 800,
      aiDelayMax: 1500,
      ...opts.settings,
    },
    idCounter: 0,
  };
  s.eventBag = freshEventBag(s);
  chronicle(s, `Anno ${s.year}: ${s.players.length} Edle ringen um die Gunst des Reiches.`);
  beginYear(s, true);
  return s;
}

function recordHistory(s: GameState, p: Player): void {
  p.history.push({ year: s.year, population: p.population, gold: p.gold + p.savings, cash: p.gold, land: p.land, grain: p.grain, title: p.title });
  if (p.history.length > 50) p.history.splice(0, p.history.length - 50);
}

/** Jahresstart: Wetter, Marktpreise, Ernte und Zufallsereignisse. */
export function beginYear(s: GameState, first = false): void {
  s.market = rollMarket(s, first ? null : s.market);
  for (const p of s.players) {
    p.landAtYearStart = p.land;
    const harvest = expectedHarvest(p, s.market.harvestFactor);
    p.harvestThisYear = harvest;
    p.grain += harvest;
    tell(
      s,
      p.id,
      `Anno Domini ${s.year}`,
      `Wetter: ${s.market.weather} (Ernte ×${s.market.harvestFactor.toFixed(2)}). Eure Bauern haben ${fmt(harvest)} Scheffel Korn eingebracht. ` +
        `Kornpreis: ${s.market.grainPrice} Taler je 10 Scheffel, Land: ${s.market.landPrice} Taler je Hektar, Leitzins: ${s.market.baseRate} %.`,
      'info',
    );
    if (!first) drawEvent(s, p);
    // Auch ausgesetzte Spieler müssen ihr Jahr bestätigen (Meldungen lesen) – handeln können sie nicht.
    p.turnDone = false;
    if (p.debtorPrison > 0)
      tell(s, p.id, 'Im Schuldturm', 'Ihr sitzt dieses Jahr im Schuldturm. Euer Volk erhält kein Korn, Euer Heer ist führerlos.', 'error');
    if (p.sickbed > 0)
      tell(s, p.id, 'Im Krankenbett', 'Ihr hütet dieses Jahr das Krankenbett. Eure Verwalter führen die Geschäfte unverändert fort.', 'warning');
  }
}

/** Sind alle menschlichen Spieler fertig? */
export function allHumansDone(s: GameState): boolean {
  return s.players.every((p) => p.isAI || p.turnDone);
}

/** Rundenwechsel (onTurnEnd): löst alle Konflikte und die Wirtschaft auf, startet das nächste Jahr. */
export function resolveYear(state: GameState): GameState {
  const s = clone(state);
  if (s.phase !== 'orders') return s;
  const serving = new Set(s.players.filter((p) => p.debtorPrison > 0 || p.sickbed > 0).map((p) => p.id));

  // 1. Verdeckte Operationen (in zufälliger Reihenfolge)
  const covert = shuffle(s, s.queue.filter((a): a is CovertAction => a.kind === 'covert'));
  for (const a of covert) resolveCovert(s, a);

  // 2. Kriege
  const attacks = shuffle(s, s.queue.filter((a): a is AttackAction => a.kind === 'attack'));
  const away: Record<string, number> = {};
  for (const a of attacks) away[a.from] = (away[a.from] ?? 0) + a.fraction;
  for (const a of attacks) resolveAttack(s, a, away);

  // 3. Reichstag
  resolveElection(s);

  // 4. Wirtschaft, Bank, Insolvenz
  for (const p of s.players) {
    const report = calculateEconomyTurn(p, s.market, {
      ratRate: randFloat(s, RAT_MIN, RAT_MAX),
      rationOverride: p.debtorPrison > 0 ? 0 : undefined,
      tradeAgreements: tradeAgreementCount(s, p.id),
    });
    p.grain = Math.max(0, p.grain - report.grainDistributed - report.ratLoss);
    p.population = Math.max(0, p.population + report.populationAfter - p.population);
    const intercepted = Math.min(p.taxIntercepted ?? 0, Math.max(0, report.taxIncome));
    p.taxIntercepted = 0;
    p.gold += report.taxIncome - intercepted + report.pilgrimIncome - report.militaryUpkeep - report.buildingUpkeep - report.landlessKnightPay;
    if (report.desertedKnights > 0) {
      p.military.knights -= report.desertedKnights;
      tell(s, p.id, 'Ritter desertieren!', `${report.desertedKnights} landlose Ritter haben Euch verlassen, weil Ihr weder Lehen noch Strafsold bieten konntet.`, 'error');
    } else if (report.landlessKnights > 0) {
      tell(s, p.id, 'Landlose Ritter', `${report.landlessKnights} Ritter ohne Lehen forderten ${fmt(report.landlessKnightPay)} Taler Strafsold.`, 'warning');
    }
    const bank = processBanking(s, p);
    p.lastReport = {
      ...report,
      year: s.year,
      taxIntercepted: intercepted,
      netGold: report.netGold - intercepted,
      savingsInterest: bank.interest,
      loanPayments: bank.payments,
    };

    if (report.starved > 0)
      tell(s, p.id, 'Hungersnot!', `${fmt(report.starved)} Menschen sind verhungert, ${fmt(report.emigrants)} sind abgewandert.`, 'error');
    if (report.ratLoss > 0 && report.ratLoss > p.grain * 0.15)
      tell(s, p.id, 'Rattenfraß', `Ratten haben ${fmt(report.ratLoss)} Scheffel aus Euren Speichern gefressen.`, 'warning');

    resolveInsolvency(s, p);
    processTraining(p);
  }

  // 4b. Diplomatie: Angebote zustellen bzw. verfallen lassen, ausgelaufene Verträge beenden
  processOffers(s);
  expireTreaties(s);

  // 5. Status-Zähler (Schuldturm/Krankenbett) – nur für jene, die dieses Jahr ausgesetzt haben
  for (const id of serving) {
    const p = getPlayer(s, id);
    if (p.debtorPrison > 0) p.debtorPrison -= 1;
    if (p.sickbed > 0) p.sickbed -= 1;
  }

  // 6. Groll verblasst, Neid auf den Führenden wächst (Blue-Shell-Effekt); Skandale verjähren
  updateGrudges(s);
  for (const p of s.players) ageScandals(s, p);

  // 7. Titel
  checkTitles(s);

  // 8. Kaiserwahl ausrufen?
  maybeCallElection(s);

  for (const p of s.players) recordHistory(s, p);
  s.queue = [];

  if (s.phase === 'orders' && s.year >= s.settings.endYear) {
    const ranking = rankPlayers(s);
    s.phase = 'ended';
    s.winnerId = ranking[0].id;
    s.endReason = `Das Jahr ${s.settings.endYear} ist erreicht. ${ranking[0].name} (${TITLES[ranking[0].title]}) führt die Rangliste an.`;
    chronicle(s, s.endReason);
  }

  if (s.phase === 'orders') {
    s.year += 1;
    beginYear(s);
  }
  return s;
}

export function rankPlayers(s: GameState): Player[] {
  return [...s.players].sort((a, b) => score(b) - score(a));
}

/** Alle SCANDAL_DECAY_YEARS Jahre gerät ein Skandal in Vergessenheit. */
function ageScandals(s: GameState, p: Player): void {
  if (p.scandals <= 0) {
    p.scandalClock = 0;
    return;
  }
  p.scandalClock = (p.scandalClock ?? 0) + 1;
  if (p.scandalClock >= SCANDAL_DECAY_YEARS) {
    p.scandals -= 1;
    p.scandalClock = 0;
    tell(s, p.id, 'Gras über die Sache', `Ein alter Skandal ist in Vergessenheit geraten. Verbleibende Skandale: ${p.scandals}.`, 'good');
  }
}

function updateGrudges(s: GameState): void {
  const leader = rankPlayers(s)[0];
  for (const p of s.players) {
    for (const id of Object.keys(p.grudges)) {
      p.grudges[id] = Math.round(p.grudges[id] * GRUDGE.decay);
      if (p.grudges[id] <= 0) delete p.grudges[id];
    }
    if (leader && leader.id !== p.id && score(leader) > score(p) * 1.15) {
      p.grudges[leader.id] = Math.min(150, (p.grudges[leader.id] ?? 0) + GRUDGE.envy * 0.4);
    }
  }
}

/** Hilfsfunktion: Kornbedarf mit gewünschter Ration. */
export function grainForRation(p: Player, ration: number): number {
  return Math.ceil((grainNeed(p) * ration) / 100);
}
