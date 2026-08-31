/**
 * Day grouping for the schedule — frame `27_Calendar`.
 *
 * The frame stacks entries under a date chip, so the screen needs its items bucketed by
 * calendar day and each day's items in time order. Days are counted in PKT: an 11 PM slot
 * and a 1 AM one belong to different days on the calendar even though they are two hours
 * apart, and that is how a player reads their week.
 */
import { toPkt } from './datetime';

export interface AgendaEntry {
  id: string;
  startAt: string;
}

export interface AgendaDay<T extends AgendaEntry> {
  /** ISO instant of the first entry that day — the chip and heading read from it. */
  day: string;
  entries: T[];
}

/** Buckets entries by PKT calendar day, days ascending and entries ascending within a day. */
export function groupByDay<T extends AgendaEntry>(entries: T[]): AgendaDay<T>[] {
  const buckets = new Map<string, T[]>();

  for (const entry of entries) {
    const { year, month, day } = toPkt(entry.startAt);
    const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(entry);
    else buckets.set(key, [entry]);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, items]) => {
      const sorted = [...items].sort(
        (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
      );
      return { day: sorted[0].startAt, entries: sorted };
    });
}

const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/** The peach chip: a short month over the day number. */
export function chipParts(instant: string): { month: string; day: string } {
  const parts = toPkt(instant);
  return {
    month: MONTHS_SHORT[parts.month - 1],
    day: String(parts.day).padStart(2, '0'),
  };
}

/** `WED, 2 SEPTEMBER 2026` — the frame prints the heading in caps. */
export function headingFor(instant: string): string {
  const parts = toPkt(instant);
  const month = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ][parts.month - 1];
  return `${WEEKDAYS_SHORT[parts.weekday]}, ${parts.day} ${month} ${parts.year}`;
}
