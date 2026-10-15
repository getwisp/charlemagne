// Zufallsereignisse als Shuffle-Bag: Ein gemischtes Deck aus 20 Karten wird
// abgearbeitet und erst neu gemischt, wenn es leer ist. Das verhindert
// mehrfaches Pech in Folge, das reines RNG erzeugen würde.

import { randFloat, randInt, shuffle } from './rng';
import type { GameState, Player } from './types';
import { tell, fmt } from './util';

export interface EventCard {
  id: string;
  count: number;
  condition: (p: Player) => boolean;
  apply: (s: GameState, p: Player) => void;
}

export const EVENT_CARDS: EventCard[] = [
  {
    id: 'pest',
    count: 2,
    condition: (p) => p.population > 3000,
    apply: (s, p) => {
      const lost = Math.round(p.population * randFloat(s, 0.1, 0.25));
      p.population -= lost;
      tell(s, p.id, 'Die Pest!', `Der Schwarze Tod wütet in Euren Landen. ${fmt(lost)} Untertanen sind gestorben.`, 'error');
    },
  },
  {
    id: 'diebe',
    count: 2,
    condition: (p) => p.gold > 500,
    apply: (s, p) => {
      // Die Garde mindert den Schaden, das Sparkonto ist zu 100 % sicher.
      const guardShield = Math.min(0.6, p.military.guards / Math.max(1, p.population / 40));
      const lost = Math.round(p.gold * randFloat(s, 0.15, 0.3) * (1 - guardShield));
      p.gold -= lost;
      tell(
        s,
        p.id,
        'Diebe in der Schatzkammer',
        `Diebe sind in die Schatzkammer eingebrochen und haben ${fmt(lost)} Taler erbeutet. Euer Sparguthaben bei der Bank blieb unangetastet.`,
        'error',
      );
    },
  },
  {
    id: 'feuer',
    count: 1,
    condition: (p) => p.buildings.market + p.buildings.mill > 0,
    apply: (s, p) => {
      const kind = p.buildings.mill > 0 && (p.buildings.market === 0 || randInt(s, 0, 1) === 0) ? 'mill' : 'market';
      p.buildings[kind] -= 1;
      tell(s, p.id, 'Großfeuer!', `Ein Feuer hat ${kind === 'mill' ? 'eine Mühle' : 'einen Markt'} vollständig zerstört.`, 'error');
    },
  },
  {
    id: 'heuschrecken',
    count: 1,
    condition: (p) => p.grain > 1000,
    apply: (s, p) => {
      const lost = Math.round(p.grain * randFloat(s, 0.2, 0.4));
      p.grain -= lost;
      tell(s, p.id, 'Heuschreckenplage', `Heuschreckenschwärme haben ${fmt(lost)} Scheffel Korn gefressen.`, 'warning');
    },
  },
  {
    id: 'erbschaft',
    count: 1,
    condition: () => true,
    apply: (s, p) => {
      const gain = randInt(s, 20, 60) * 100;
      p.gold += gain;
      tell(s, p.id, 'Eine Erbschaft', `Eine entfernte Tante hinterlässt Euch ${fmt(gain)} Taler.`, 'good');
    },
  },
  {
    id: 'pilger',
    count: 1,
    condition: (p) => p.buildings.cathedral > 0,
    apply: (s, p) => {
      const gain = 1500 * p.buildings.cathedral;
      p.gold += gain;
      tell(s, p.id, 'Pilgerströme', `Pilger strömen zu Euren Kathedralen und spenden ${fmt(gain)} Taler.`, 'good');
    },
  },
  {
    id: 'kindersegen',
    count: 1,
    condition: () => true,
    apply: (s, p) => {
      const gain = Math.round(p.population * 0.05);
      p.population += gain;
      tell(s, p.id, 'Kindersegen', `Ein fruchtbares Jahr: ${fmt(gain)} Kinder mehr als üblich wurden geboren.`, 'good');
    },
  },
  {
    id: 'fluechtlinge',
    count: 1,
    condition: () => true,
    apply: (s, p) => {
      const gain = randInt(s, 200, 500);
      p.population += gain;
      tell(s, p.id, 'Flüchtlinge', `${fmt(gain)} Glaubensflüchtlinge suchen Zuflucht in Euren Landen.`, 'info');
    },
  },
  {
    id: 'meuterei',
    count: 1,
    condition: (p) => p.military.mercenaries > 50,
    apply: (s, p) => {
      const lost = Math.round(p.military.mercenaries * randFloat(s, 0.1, 0.2));
      p.military.mercenaries -= lost;
      tell(s, p.id, 'Meuterei', `${fmt(lost)} Söldner haben gemeutert und sind desertiert.`, 'warning');
    },
  },
  {
    id: 'hexenprozess',
    count: 1,
    condition: (p) => p.justice >= 4,
    apply: (s, p) => {
      p.scandals += 1;
      const lost = Math.round(p.population * 0.02);
      p.population -= lost;
      tell(
        s,
        p.id,
        'Hexenprozess',
        `Eure strengen Richter haben einen Hexenprozess angestrengt. ${fmt(lost)} Bürger fliehen, die Kirche ist empört (Skandal).`,
        'warning',
      );
    },
  },
  {
    id: 'silberader',
    count: 1,
    condition: () => true,
    apply: (s, p) => {
      const gain = Math.round(p.land * randFloat(s, 0.2, 0.4));
      p.gold += gain;
      tell(s, p.id, 'Silberader', `In Euren Bergen wurde eine Silberader entdeckt: ${fmt(gain)} Taler.`, 'good');
    },
  },
  {
    id: 'ruhig',
    count: 7,
    condition: () => true,
    apply: () => {},
  },
];

export function freshEventBag(s: GameState): string[] {
  const bag: string[] = [];
  for (const card of EVENT_CARDS) for (let i = 0; i < card.count; i++) bag.push(card.id);
  return shuffle(s, bag);
}

/**
 * Zieht für einen Spieler die nächste Karte, deren Bedingung erfüllt ist.
 * Übersprungene Karten bleiben im Deck. Ist das Deck leer, wird neu gemischt.
 */
export function drawEvent(s: GameState, p: Player): string {
  if (s.eventBag.length === 0) s.eventBag = freshEventBag(s);
  for (let i = 0; i < s.eventBag.length; i++) {
    const card = EVENT_CARDS.find((c) => c.id === s.eventBag[i]);
    if (card && card.condition(p)) {
      s.eventBag.splice(i, 1);
      card.apply(s, p);
      return card.id;
    }
  }
  // Keine passende Karte: ruhiges Jahr, Deck bleibt unverändert.
  return 'ruhig';
}
