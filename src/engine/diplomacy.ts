// Diplomatie: Nichtangriffspakt, Handelsabkommen, Verteidigungsbündnis.
// Angebote laufen wie Intrigen über die Queue und werden beim Jahreswechsel
// zugestellt; der Empfänger antwortet in seinem nächsten Zug. Verträge laufen
// fest TREATY_YEARS Jahre – wer früher raus will, muss sie brechen.

import { GRUDGE, TREATIES, TREATY_YEARS, titleName } from './constants';
import { calculateEconomyTurn, type EconomyPreview } from './economy';
import type { GameState, OfferAction, Player, Treaty, TreatyOffer, TreatyType } from './types';
import { chronicle, fmt, getPlayer, nextId, tell } from './util';

const cap = (w: string) => w[0].toUpperCase() + w.slice(1);

export function treatiesOf(s: GameState, pid: string): Treaty[] {
  return (s.treaties ?? []).filter((t) => t.parties.includes(pid));
}

export function treatiesBetween(s: GameState, a: string, b: string): Treaty[] {
  return (s.treaties ?? []).filter((t) => t.parties.includes(a) && t.parties.includes(b));
}

export function partnerOf(t: Treaty, pid: string): string {
  return t.parties[0] === pid ? t.parties[1] : t.parties[0];
}

/** Nichtangriffspakt oder Bündnis: ein Angriff wäre Vertragsbruch. */
export function hasPeace(s: GameState, a: string, b: string): boolean {
  return treatiesBetween(s, a, b).some((t) => t.type === 'nap' || t.type === 'alliance');
}

export function alliesOf(s: GameState, pid: string): string[] {
  return treatiesOf(s, pid)
    .filter((t) => t.type === 'alliance')
    .map((t) => partnerOf(t, pid));
}

export function tradeAgreementCount(s: GameState, pid: string): number {
  return treatiesOf(s, pid).filter((t) => t.type === 'trade').length;
}

/** Verbleibende Jahre inklusive des laufenden. */
export function yearsLeft(t: Treaty, year: number): number {
  return t.until - year + 1;
}

/** Wirtschaftsvorschau mit allen Einflüssen aus dem Spielzustand (Handelsabkommen). */
export function previewEconomy(s: GameState, p: Player): EconomyPreview {
  return calculateEconomyTurn(p, s.market, { tradeAgreements: tradeAgreementCount(s, p.id) });
}

/** Warum ein Vertrag dieser Art zwischen beiden nicht möglich ist – oder null. */
export function offerBlocker(s: GameState, from: string, to: string, type: TreatyType): string | null {
  if (from === to) return 'Ein Vertrag mit sich selbst ist sinnlos.';
  const existing = treatiesBetween(s, from, to);
  if (type === 'trade' && existing.some((t) => t.type === 'trade')) return 'Es besteht bereits ein Handelsabkommen.';
  if (type === 'nap' && existing.some((t) => t.type === 'nap' || t.type === 'alliance'))
    return 'Es besteht bereits Frieden (Nichtangriffspakt oder Bündnis).';
  if (type === 'alliance' && existing.some((t) => t.type === 'alliance')) return 'Es besteht bereits ein Bündnis.';
  const pending = s.queue.some((a) => a.kind === 'offer' && a.from === from && a.to === to && a.treatyType === type);
  const open = (s.offers ?? []).some((o) => o.from === from && o.to === to && o.type === type);
  if (pending || open) return 'Dieses Angebot ist bereits unterwegs.';
  return null;
}

/** Schließt einen Vertrag ab (beim Annehmen eines Angebots). Ein Bündnis ersetzt einen Nichtangriffspakt. */
export function concludeTreaty(s: GameState, type: TreatyType, a: string, b: string): Treaty {
  if (type === 'alliance') s.treaties = (s.treaties ?? []).filter((t) => !(t.type === 'nap' && t.parties.includes(a) && t.parties.includes(b)));
  const treaty: Treaty = { id: nextId(s, 't'), type, parties: [a, b], since: s.year, until: s.year + TREATY_YEARS - 1 };
  (s.treaties ??= []).push(treaty);
  return treaty;
}

/**
 * Vertragsbruch. Bei einem Angriff: Skandal, Casus Belli für das Opfer und Groll
 * aller anderen Herrscher. Bei einer enttarnten Intrige (Raub, Sabotage, Attentat)
 * platzen die Verträge nur – die normalen Enttarnungsfolgen greifen ohnehin.
 */
export function breakTreaties(s: GameState, breaker: Player, victim: Player, reason: 'attack' | 'intrigue'): void {
  const broken = treatiesBetween(s, breaker.id, victim.id);
  if (broken.length === 0) return;
  s.treaties = (s.treaties ?? []).filter((t) => !broken.includes(t));
  const names = broken.map((t) => `${TREATIES[t.type].den} ${TREATIES[t.type].name}`).join(' und ');
  if (reason === 'attack') {
    breaker.scandals += 1;
    if (!victim.casusBelli.includes(breaker.id)) victim.casusBelli.push(breaker.id);
    for (const p of s.players) {
      if (p.id === breaker.id) continue;
      p.grudges[breaker.id] = (p.grudges[breaker.id] ?? 0) + GRUDGE.treatyBreach;
    }
    tell(s, breaker.id, 'Vertragsbruch', `Ihr habt mit dem Angriff auf ${victim.name} ${names} gebrochen. Die Kirchenfürsten sind empört (Skandal), und kein Herrscher wird Euer Wort so bald vergessen.`, 'warning');
    tell(s, victim.id, 'Verrat!', `${breaker.name} hat ${names} gebrochen und Euch überfallen. Ihr habt einen Casus Belli gegen ${breaker.female ? 'die Wortbrüchige' : 'den Wortbrüchigen'}.`, 'error');
    chronicle(s, `Wortbruch: ${breaker.name} bricht ${names} mit ${victim.name}.`);
  } else {
    tell(s, breaker.id, 'Vertrag aufgelöst', `Nach der Enttarnung Eures Agenten hat ${victim.name} ${names} aufgelöst.`, 'warning');
    tell(s, victim.id, 'Vertrag aufgelöst', `Wer Euch Diebe und Saboteure schickt, ist kein Partner: Ihr löst ${names} mit ${breaker.name} auf.`, 'warning');
  }
}

/**
 * Jahreswechsel: unbeantwortete Angebote des Vorjahres verfallen (Mitgift zurück),
 * neue Angebote aus der Queue werden zugestellt.
 */
export function processOffers(s: GameState): void {
  const offers = s.offers ?? [];
  const expired = offers.filter((o) => o.delivered < s.year);
  for (const o of expired) {
    const from = getPlayer(s, o.from);
    from.gold += o.gold;
    tell(s, o.from, 'Angebot verfallen', `${getPlayer(s, o.to).name} hat auf Euer Angebot (${TREATIES[o.type].name}) nicht geantwortet.${o.gold ? ` Die Mitgift von ${fmt(o.gold)} Talern kehrt zurück.` : ''}`, 'info');
  }
  s.offers = offers.filter((o) => o.delivered >= s.year);
  for (const a of s.queue.filter((q): q is OfferAction => q.kind === 'offer')) {
    const offer: TreatyOffer = { id: a.id, type: a.treatyType, from: a.from, to: a.to, gold: a.gold, delivered: s.year };
    s.offers.push(offer);
    const from = getPlayer(s, a.from);
    tell(
      s,
      a.to,
      'Ein Gesandter bittet um Audienz',
      `${titleName(from.title, from.female)} ${from.name} bietet Euch ${TREATIES[a.treatyType].einen} ${TREATIES[a.treatyType].name} für ${TREATY_YEARS} Jahre an${a.gold ? ` – mit einer Mitgift von ${fmt(a.gold)} Talern` : ''}. Antwortet im Thronsaal (Diplomatie).`,
      'info',
    );
  }
}

/** Jahreswechsel: Verträge, deren Laufzeit endet, laufen regulär aus. */
export function expireTreaties(s: GameState): void {
  const ending = (s.treaties ?? []).filter((t) => t.until <= s.year);
  for (const t of ending) {
    const [a, b] = t.parties.map((id) => getPlayer(s, id));
    tell(s, a.id, 'Vertrag ausgelaufen', `${cap(TREATIES[t.type].der)} ${TREATIES[t.type].name} mit ${b.name} ist regulär ausgelaufen.`, 'info');
    tell(s, b.id, 'Vertrag ausgelaufen', `${cap(TREATIES[t.type].der)} ${TREATIES[t.type].name} mit ${a.name} ist regulär ausgelaufen.`, 'info');
  }
  s.treaties = (s.treaties ?? []).filter((t) => t.until > s.year);
}
