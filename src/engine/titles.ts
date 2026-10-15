import { REQUIREMENT_LABELS, T, TITLES, TITLE_REQUIREMENTS, type TitleRequirements } from './constants';
import { cityCount } from './economy';
import type { GameState, Player } from './types';
import { chronicle, tell } from './util';

export interface RequirementStatus {
  key: keyof TitleRequirements;
  label: string;
  required: number;
  current: number;
  met: boolean;
  /** 0..1 Erfüllungsgrad */
  progress: number;
}

export function requirementValue(p: Player, key: keyof TitleRequirements): number {
  switch (key) {
    case 'land':
      return p.land;
    case 'population':
      return p.population;
    case 'market':
    case 'mill':
    case 'palace':
    case 'cathedral':
      return p.buildings[key];
    case 'cities':
      return cityCount(p.buildings);
    case 'knights':
      return p.military.knights;
    case 'gold':
      return p.gold + p.savings;
  }
}

/** Voraussetzungen für den nächsten Titel (leer, wenn König oder Kaiser). */
export function nextTitleRequirements(p: Player): RequirementStatus[] {
  if (p.title >= T.KOENIG) return [];
  const req = TITLE_REQUIREMENTS[p.title + 1];
  return (Object.keys(req) as (keyof TitleRequirements)[]).map((key) => {
    const required = req[key] ?? 0;
    const current = requirementValue(p, key);
    return {
      key,
      label: REQUIREMENT_LABELS[key],
      required,
      current,
      met: current >= required,
      progress: required > 0 ? Math.min(1, current / required) : 1,
    };
  });
}

export function canBePromoted(p: Player): boolean {
  const reqs = nextTitleRequirements(p);
  return reqs.length > 0 && reqs.every((r) => r.met);
}

export function demote(s: GameState, p: Player, reason: string): void {
  if (p.title <= T.EDLER) return;
  p.title -= 1;
  tell(s, p.id, 'Rückstufung', `${reason} Ihr werdet zum ${TITLES[p.title]} zurückgestuft.`, 'error');
  chronicle(s, `${p.name} wurde zum ${TITLES[p.title]} zurückgestuft (${reason})`);
}

/** Prüft Beförderungen (max. 1 pro Runde) und Degradierung durch massiven Landverlust. */
export function checkTitles(s: GameState): void {
  for (const p of s.players) {
    if (p.landAtYearStart > 0 && p.land < p.landAtYearStart * 0.5) {
      demote(s, p, 'Ihr habt mehr als die Hälfte Eures Landes verloren.');
      continue;
    }
    if (canBePromoted(p)) {
      p.title += 1;
      p.lastPromotionYear = s.year;
      tell(s, p.id, 'Beförderung!', `Der Kaiser erhebt Euch in den Stand eines ${TITLES[p.title]}!`, 'good');
      chronicle(s, `${p.name} wurde zum ${TITLES[p.title]} erhoben.`);
      if (p.title === T.GRAF)
        tell(s, p.id, 'Ritterschlag', 'Als Graf dürft Ihr nun Knappen zu Rittern schlagen.', 'info');
    }
  }
}
