// Das politische Endspiel: der Reichstag.
// Sobald ein König eine Kathedrale besitzt, wird die Kaiserwahl ausgerufen.
// Im Folgejahr können Kandidaten verdeckt bestechen (blinde Auktion), am
// Jahresende stimmt das Kollegium aus 7 Sitzen ab. 4 Stimmen gewinnen.

import {
  BISHOP_CATHEDRAL_BONUS,
  BISHOP_NAMES,
  BISHOP_MIN_SCORE,
  BISHOP_PIETY_BONUS,
  BISHOP_SCANDAL_MALUS,
  ELECTION_MAJORITY,
  ELECTION_SEATS,
  T,
  TITLES,
} from './constants';
import { piety } from './economy';
import { randFloat } from './rng';
import type { BribeAction, ElectionResult, ElectionSeat, GameState, Player } from './types';
import { chronicle, fmt, getPlayer, tell } from './util';

export function electionCandidates(s: GameState): Player[] {
  return s.players.filter((p) => p.title === T.KOENIG && p.buildings.cathedral >= 1);
}

/** Wahlkollegium: Kurfürsten (und höher) der Spieler, aufgefüllt mit KI-Kirchenfürsten. */
export function buildSeats(s: GameState): ElectionSeat[] {
  const electors = s.players
    .filter((p) => p.title >= T.KURFUERST)
    .sort((a, b) => b.title - a.title || b.land - a.land)
    .slice(0, ELECTION_SEATS);
  const seats: ElectionSeat[] = electors.map((p) => ({ kind: 'player', playerId: p.id }));
  let i = 0;
  while (seats.length < ELECTION_SEATS) {
    seats.push({ kind: 'bishop', name: BISHOP_NAMES[i % BISHOP_NAMES.length], bias: Math.round(randFloat(s, -5000, 5000)) });
    i++;
  }
  return seats;
}

/** Ruft die Kaiserwahl aus, falls ein König mit Kathedrale existiert. */
export function maybeCallElection(s: GameState): void {
  if (s.election || s.winnerId) return;
  const candidates = electionCandidates(s);
  if (candidates.length === 0) return;
  s.election = { year: s.year + 1, candidates: candidates.map((c) => c.id), seats: buildSeats(s) };
  const names = candidates.map((c) => c.name).join(', ');
  chronicle(s, `Der Reichstag wird einberufen! Kandidaten für die Kaiserkrone: ${names}.`);
  for (const p of s.players) {
    tell(
      s,
      p.id,
      'Der Reichstag ist einberufen!',
      `Im Jahr ${s.year + 1} wählt das Kollegium den neuen Kaiser. Kandidaten: ${names}. ` +
        (candidates.some((c) => c.id === p.id)
          ? 'Ihr seid Kandidat! Werbt im Thronsaal mit verdeckten Bestechungsgeldern um die Stimmen.'
          : 'Eure Stimme oder Euer Gold könnten entscheiden.'),
      'warning',
    );
  }
}

export function seatLabel(s: GameState, seat: ElectionSeat): string {
  return seat.kind === 'bishop' ? seat.name : `${getPlayer(s, seat.playerId).name} (${TITLES[getPlayer(s, seat.playerId).title]})`;
}

function bribesFor(bribes: BribeAction[], seat: number, candidate: string): number {
  return bribes.filter((b) => b.seat === seat && b.from === candidate).reduce((sum, b) => sum + b.gold, 0);
}

/** Wie bewertet ein KI-Bischof einen Kandidaten? Schmiergeld + Kathedralen + Frömmigkeit − Skandale */
export function bishopScore(s: GameState, seatIdx: number, candidate: Player, bribes: BribeAction[]): number {
  const seat = s.election!.seats[seatIdx];
  const bias = seat.kind === 'bishop' ? seat.bias : 0;
  return (
    bribesFor(bribes, seatIdx, candidate.id) +
    candidate.buildings.cathedral * BISHOP_CATHEDRAL_BONUS +
    piety(candidate) * BISHOP_PIETY_BONUS -
    candidate.scandals * BISHOP_SCANDAL_MALUS +
    bias
  );
}

export function resolveElection(s: GameState): ElectionResult | null {
  const e = s.election;
  if (!e || e.year !== s.year) return null;
  const bribes = s.queue.filter((a): a is BribeAction => a.kind === 'bribe');
  const votes = s.queue.filter((a) => a.kind === 'vote');
  // Kandidaten müssen die Bedingungen noch erfüllen (z. B. nicht degradiert).
  const candidates = e.candidates.map((id) => getPlayer(s, id)).filter((c) => c.title === T.KOENIG);
  const result: ElectionResult = { year: s.year, votes: [], tally: {}, winner: null };
  for (const c of candidates) result.tally[c.id] = 0;

  e.seats.forEach((seat, idx) => {
    let choice: string | null = null;
    if (candidates.length > 0) {
      if (seat.kind === 'bishop') {
        const scored = candidates.map((c) => ({ c, v: bishopScore(s, idx, c, bribes) })).sort((a, b) => b.v - a.v);
        // Ein Kirchenfürst will überzeugt werden – sonst enthält er sich.
        choice = scored[0].v >= BISHOP_MIN_SCORE ? scored[0].c.id : null;
      } else {
        const voter = getPlayer(s, seat.playerId);
        if (candidates.some((c) => c.id === voter.id)) choice = voter.id;
        else if (voter.isAI) choice = aiVote(voter, idx, candidates, bribes);
        else {
          const v = votes.find((a) => a.from === voter.id);
          choice = v && v.kind === 'vote' && candidates.some((c) => c.id === v.candidate) ? v.candidate : null;
        }
      }
    }
    if (choice) result.tally[choice] = (result.tally[choice] ?? 0) + 1;
    result.votes.push({ seat: seatLabel(s, seat), candidate: choice });
  });

  // Bestechungsgelder an Mitspieler wechseln den Besitzer; an Bischöfe sind sie verloren.
  for (const b of bribes) {
    const seat = e.seats[b.seat];
    if (seat?.kind === 'player') {
      const receiver = getPlayer(s, seat.playerId);
      receiver.gold += b.gold;
      tell(s, receiver.id, 'Ein diskretes Geschenk', `${getPlayer(s, b.from).name} lässt Euch ${fmt(b.gold)} Taler zukommen – für Eure Stimme beim Reichstag.`, 'info');
    }
  }

  const sorted = Object.entries(result.tally).sort((a, b) => b[1] - a[1]);
  const top = sorted[0];
  if (top && top[1] >= ELECTION_MAJORITY) {
    result.winner = top[0];
    const winner = getPlayer(s, top[0]);
    winner.title = T.KAISER;
    s.winnerId = winner.id;
    s.phase = 'ended';
    s.endReason = `${winner.name} wurde mit ${top[1]} von ${ELECTION_SEATS} Stimmen zum Kaiser gewählt und im Aachener Dom auf dem Thron Karls des Großen gekrönt!`;
    chronicle(s, s.endReason);
    for (const p of s.players)
      tell(s, p.id, 'Habemus Imperatorem!', s.endReason, p.id === winner.id ? 'good' : 'warning');
  } else {
    const text = `Der Reichstag endet im Patt (${sorted.map(([id, n]) => `${getPlayer(s, id).name}: ${n}`).join(', ') || 'keine Stimmen'}). Alle Bestechungsgelder sind verfallen. Die Wahl kann neu ausgerufen werden.`;
    chronicle(s, 'Der Reichstag endet im Patt.');
    for (const p of s.players) tell(s, p.id, 'Patt im Reichstag', text, 'warning');
  }
  s.lastElection = result;
  s.election = null;
  return result;
}

/**
 * KI-Kurfürsten wählen nach Schmiergeld, Frömmigkeit und Groll. Wiegt der Groll
 * schwerer als alles, was ein Kandidat bietet, enthalten sie sich – wer einen
 * überfallen hat, bekommt die Stimme nicht schon deshalb, weil er allein antritt.
 */
export function aiVote(voter: Player, seatIdx: number, candidates: Player[], bribes: BribeAction[]): string | null {
  const scored = candidates
    .map((c) => ({ c, v: bribesFor(bribes, seatIdx, c.id) - (voter.grudges[c.id] ?? 0) * 150 + piety(c) * 200 }))
    .sort((a, b) => b.v - a.v);
  return scored[0].v >= 0 ? scored[0].c.id : null;
}
