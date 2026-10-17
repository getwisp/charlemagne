// Zentrales Datenmodell von Karl 98.
// Der gesamte Spielzustand ist serialisierbares JSON, damit er als
// Spielstand (localStorage / Datei) für Hot-Seat- und asynchrone Partien taugt.

export type Archetype = 'pfeffersack' | 'kriegstreiber' | 'raenkeschmiedin' | 'kirchenfuerst';

export type BuildingType = 'market' | 'mill' | 'granary' | 'palace' | 'cathedral';

export type Buildings = Record<BuildingType, number>;

/** Einheiten, die man direkt anwerben kann. Ritter entstehen nur über den Ritterschlag. */
export type RecruitableUnit = 'guards' | 'mercenaries' | 'cannons' | 'squires';
export type DismissableUnit = RecruitableUnit | 'knights';

export interface Military {
  /** Garde: innere Sicherheit, blockt Spione/Attentäter, zieht nie in den Krieg. */
  guards: number;
  /** Heer */
  mercenaries: number;
  cannons: number;
  squires: number;
  /** Erfahrungsstufe der Knappen (0–3). Ab 2 können sie zum Ritter geschlagen werden. */
  squireXp: number;
  /** Ritter: 0 Taler Sold, blockieren aber je 50 ha Lehnsland. */
  knights: number;
  /** Ausbildungsstand des Heeres (Multiplikator, 0.8–1.5). */
  training: number;
}

export interface Loan {
  id: string;
  principal: number;
  remaining: number;
  /** Zinssatz in Prozent p.a., fest bei Abschluss. */
  rate: number;
  termYears: number;
  yearsLeft: number;
  /** Jährliche Rate (Annuität). */
  annuity: number;
  forced?: boolean;
}

export interface Taxes {
  /** Einkommensteuer in % (0–50) */
  income: number;
  /** Mehrwertsteuer in % (0–30) */
  sales: number;
  /** Zölle in % (0–30) */
  tolls: number;
}

export interface HistoryEntry {
  year: number;
  population: number;
  gold: number;
  land: number;
  grain: number;
  title: number;
  /** Bargeld ohne Sparkonto (fehlt in älteren Spielständen) */
  cash?: number;
}

export type Weather = 'Dürre' | 'Missernte' | 'Mäßig' | 'Normal' | 'Gut' | 'Prächtig';

export interface MarketState {
  weather: Weather;
  /** Ernte-Multiplikator 0.4–1.6 */
  harvestFactor: number;
  /** Taler je 10 Scheffel Korn (5–50) */
  grainPrice: number;
  /** Taler je Hektar Land (8–40) */
  landPrice: number;
  /** Leitzins in % */
  baseRate: number;
}

export interface YearReport {
  year: number;
  harvest: number;
  grainDistributed: number;
  ratLoss: number;
  births: number;
  deaths: number;
  starved: number;
  immigrants: number;
  emigrants: number;
  taxIncome: number;
  /** Davon von Dieben abgefangen */
  taxIntercepted: number;
  /** Spenden der Pilger */
  pilgrimIncome: number;
  incomeTax: number;
  salesTax: number;
  tolls: number;
  savingsInterest: number;
  militaryUpkeep: number;
  buildingUpkeep: number;
  loanPayments: number;
  landlessKnightPay: number;
  desertedKnights: number;
  netGold: number;
}

export interface SpyIntel {
  year: number;
  guards: number;
  justice: number;
  gold: number;
  army: number;
  /** Steuereinnahmen pro Jahr zum Zeitpunkt des Berichts */
  taxIncome: number;
}

export interface Player {
  id: string;
  name: string;
  /** Name des aktuellen Regenten (wechselt nach erfolgreichem Attentat). */
  regentName: string;
  generation: number;
  color: string;
  isAI: boolean;
  archetype: Archetype | null;
  /** Weibliche Titelformen (Gräfin, Königin …); fehlt in älteren Spielständen = männlich. */
  female?: boolean;
  title: number;

  gold: number;
  /** Scheffel */
  grain: number;
  /** Hektar gesamt = bebautes Land + Lehnsland + freies Ackerland */
  land: number;
  population: number;

  buildings: Buildings;
  military: Military;
  taxes: Taxes;
  /** 1 (mild) – 5 (drakonisch) */
  justice: number;
  /** Kornausgabe in % des Bedarfs (100 % = 2 Scheffel je Bürger). */
  ration: number;

  savings: number;
  loans: Loan[];

  /** Verbleibende Runden im Schuldturm (Spieler setzt aus, ist wehrlos). */
  debtorPrison: number;
  /** Verbleibende Runden im Krankenbett (nach Attentat). */
  sickbed: number;

  maneuver: boolean;
  entrenched: boolean;

  /** IDs von Spielern, gegen die ein Casus Belli besteht. */
  casusBelli: string[];
  /** Groll-Gedächtnis (nur KI relevant, positive Werte = Groll). */
  grudges: Record<string, number>;
  /** Skandale (gescheiterte Intrigen, Schuldturm, Hexenprozesse …) */
  scandals: number;

  /** Land zu Beginn des Jahres – für Degradierung bei >50 % Landverlust. */
  landAtYearStart: number;
  lastPromotionYear: number;
  history: HistoryEntry[];
  lastReport: YearReport | null;
  /** Ernte des aktuellen Jahres (für Anzeige). */
  harvestThisYear: number;
  /** Im letzten Jahreswechsel per Raub erbeutetes Gold (KI: Blutgeld-Investition). */
  loot?: number;
  /** Von Steuereintreiber-Dieben abgefangene Steuern dieses Jahres (werden bei der Abrechnung abgezogen). */
  taxIntercepted?: number;
  /** Erkenntnisse aus erfolgreicher Spionage (exakte Werte zum Zeitpunkt des Berichts). */
  intel?: Record<string, SpyIntel>;
  /** Menschlicher Spieler hat seinen Zug beendet. */
  turnDone: boolean;
}

export type CovertMission = 'spy' | 'rob' | 'sabotage' | 'assassinate';
export type SabotageTarget = 'mill' | 'market' | 'grain';

export interface AttackAction {
  kind: 'attack';
  id: string;
  from: string;
  target: string;
  /** Anteil des Heeres, der ausrückt (0.1–1). */
  fraction: number;
  /** Bereits bezahlte Marschkosten (für Erstattung bei Abbruch). */
  marchCost: number;
}

export interface CovertAction {
  kind: 'covert';
  id: string;
  from: string;
  target: string;
  mission: CovertMission;
  gold: number;
  sabotageTarget?: SabotageTarget;
}

export interface BribeAction {
  kind: 'bribe';
  id: string;
  from: string;
  /** Index des Sitzes im Wahlkollegium. */
  seat: number;
  gold: number;
}

export interface VoteAction {
  kind: 'vote';
  id: string;
  from: string;
  candidate: string;
}

/** Diplomatisches Angebot, das beim Jahreswechsel zugestellt wird. */
export interface OfferAction {
  kind: 'offer';
  id: string;
  from: string;
  to: string;
  treatyType: TreatyType;
  /** Mitgift, bei Abgabe hinterlegt; bei Ablehnung oder Verfall zurück. */
  gold: number;
}

export type QueuedAction = AttackAction | CovertAction | BribeAction | VoteAction | OfferAction;

export type TreatyType = 'nap' | 'trade' | 'alliance';

export interface Treaty {
  id: string;
  type: TreatyType;
  parties: [string, string];
  /** Erstes Jahr, in dem der Vertrag gilt */
  since: number;
  /** Letztes Jahr, in dem der Vertrag gilt (feste Laufzeit, keine Kündigung) */
  until: number;
}

/** Zugestelltes Angebot, das der Empfänger in seinem Zug annehmen oder ablehnen kann. */
export interface TreatyOffer {
  id: string;
  type: TreatyType;
  from: string;
  to: string;
  gold: number;
  /** Jahr, an dessen Ende das Angebot zugestellt wurde; es verfällt ein Jahr später. */
  delivered: number;
}

export type Severity = 'info' | 'good' | 'warning' | 'error';

export interface HeraldMessage {
  id: string;
  year: number;
  title: string;
  text: string;
  severity: Severity;
}

export type ElectionSeat =
  | { kind: 'player'; playerId: string }
  | { kind: 'bishop'; name: string; /** Persönliche Vorliebe, verdeckt */ bias: number };

export interface ElectionState {
  /** Jahr, an dessen Ende gewählt wird. */
  year: number;
  candidates: string[];
  seats: ElectionSeat[];
}

export interface ElectionResult {
  year: number;
  votes: { seat: string; candidate: string | null }[];
  tally: Record<string, number>;
  winner: string | null;
}

export interface GameSettings {
  endYear: number;
  /** Künstliche Bedenkzeit der KI in ms (min/max). */
  aiDelayMin: number;
  aiDelayMax: number;
}

export interface GameState {
  version: number;
  id: string;
  seed: number;
  /** Interner RNG-Zustand (mulberry32) */
  rng: number;
  year: number;
  startYear: number;
  phase: 'orders' | 'ended';
  players: Player[];
  market: MarketState;
  queue: QueuedAction[];
  /** Shuffle-Bag der Zufallsereignisse */
  eventBag: string[];
  /** Ungelesene Herold-Meldungen je Spieler */
  messages: Record<string, HeraldMessage[]>;
  /** Öffentliche Chronik */
  chronicle: { year: number; text: string }[];
  election: ElectionState | null;
  /** Aktive Verträge (fehlt in älteren Spielständen) */
  treaties?: Treaty[];
  /** Zugestellte, noch unbeantwortete Angebote (fehlt in älteren Spielständen) */
  offers?: TreatyOffer[];
  lastElection: ElectionResult | null;
  winnerId: string | null;
  endReason: string | null;
  settings: GameSettings;
  idCounter: number;
}
