/**
 * Display strings for domain enums.
 *
 * Kept out of the components so a copy change lands in one place — and so the Urdu pass
 * (docs/07 §5, still to do) has a single surface to translate rather than a hunt through
 * every screen.
 */
import type {
  Amenity,
  Challenge,
  ChallengeStake,
  City,
  GenderPreference,
  MatchFormat,
  SkillLevel,
  Sport,
  Team,
} from './types';

export const SPORT_LABELS: Record<Sport, string> = {
  padel: 'Padel',
  futsal: 'Futsal',
  cricket: 'Cricket',
};

export const FORMAT_LABELS: Record<MatchFormat, string> = {
  padel_singles: 'Padel Singles',
  padel_doubles: 'Padel Doubles',
  futsal_5v5: 'Futsal 5v5',
  futsal_6v6: 'Futsal 6v6',
  futsal_7v7: 'Futsal 7v7',
  cricket_box: 'Box Cricket',
  cricket_tape_ball: 'Tape-Ball',
  cricket_nets: 'Cricket Nets',
};

/** Which formats a sport offers. Drives the Create Match form. */
export const FORMATS_BY_SPORT: Record<Sport, MatchFormat[]> = {
  padel: ['padel_doubles', 'padel_singles'],
  futsal: ['futsal_5v5', 'futsal_6v6', 'futsal_7v7'],
  cricket: ['cricket_box', 'cricket_tape_ball', 'cricket_nets'],
};

export const SKILL_LABELS: Record<SkillLevel, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

/** Shortened for the card meta line, where the column is 176px wide. */
export const SKILL_SHORT: Record<SkillLevel, string> = {
  beginner: 'Beginners',
  intermediate: 'Interm.',
  advanced: 'Advanced',
};

export const GENDER_LABELS: Record<GenderPreference, string> = {
  anyone: 'Anyone',
  men: 'Men only',
  women: 'Women only',
};

export const STAKE_LABELS: Record<ChallengeStake, string> = {
  split_cost: 'Split cost',
  loser_pays: 'Loser pays',
};

export const CITY_LABELS: Record<City, string> = {
  lahore: 'Lahore',
  karachi: 'Karachi',
  islamabad: 'Islamabad',
};

export const AMENITY_LABELS: Record<Amenity, string> = {
  parking: 'Parking',
  washrooms: 'Washrooms',
  showers: 'Showers',
  seating: 'Seating',
  equipment_rental: 'Equipment rental',
  prayer_area: 'Prayer area',
  cafe: 'Café',
  floodlights: 'Floodlights',
  female_friendly_timings: 'Women-friendly timings',
};

/**
 * `Futsal 5v5 · 2 left`, the matches card title.
 *
 * "2 left" rather than "2 spots left": the card's title column is ~170px, and
 * "Padel Doubles · 2 spots left" overflows it. Spots remaining is the most important
 * thing on the card, so it is the wording that gives way, not the number.
 */
export function matchTitle(format: MatchFormat, needed: number, joined: number): string {
  const remaining = Math.max(0, needed - joined);
  return `${FORMAT_LABELS[format]} · ${remaining === 0 ? 'Full' : `${remaining} left`}`;
}

/** `Futsal 5v5 · W12–L3`, the challenge card meta line. */
export function teamRecordLine(team: Team, challenge: Challenge): string {
  return `${FORMAT_LABELS[challenge.format]} · W${team.wins}–L${team.losses}`;
}

/** `Rank 2 in Lahore`, or null for a team with no record yet. */
export function cityRankLine(team: Team): string | null {
  return team.cityRank === null ? null : `Rank ${team.cityRank} in ${CITY_LABELS[team.city]}`;
}
