/**
 * Date handling for a single-country app.
 *
 * Pakistan Standard Time is UTC+05:00 and observes no daylight saving, so a fixed
 * offset is exact here — and it stays exact on Hermes, where full-ICU `Intl` time
 * zone support cannot be relied on across both platforms.
 */

export const PKT_OFFSET_MINUTES = 5 * 60;

const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 3_600_000;

const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;
const MONTHS = [
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

/** Wall-clock fields as they read on a clock in Pakistan. */
export interface PktParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
}

/** Shifts an instant into PKT and reads its wall-clock fields. */
export function toPkt(instant: Date | string): PktParts {
  const date = typeof instant === 'string' ? new Date(instant) : instant;

  /*
   * An unparseable instant is rejected here rather than allowed through as `NaN`.
   *
   * Without this every field below comes back `NaN`, which survives arithmetic and array
   * lengths untouched and only fails much later — a bad `day` query parameter surfaced as
   * `RangeError: Invalid time value` inside the slot grid, three frames from the cause, and
   * reached the client as a 500. The offending value was a date whose `+05:00` offset had
   * been decoded as a space, which is what a URL does to an unencoded `+`.
   */
  if (Number.isNaN(date.getTime())) {
    throw new RangeError(`Not a date: ${String(instant)}`);
  }

  const shifted = new Date(date.getTime() + PKT_OFFSET_MINUTES * MS_PER_MINUTE);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    weekday: shifted.getUTCDay(),
  };
}

/** Days between two instants, counted as calendar days in PKT rather than 24h spans. */
export function pktDayDifference(from: Date | string, to: Date | string): number {
  const a = toPkt(from);
  const b = toPkt(to);
  const dayA = Date.UTC(a.year, a.month - 1, a.day);
  const dayB = Date.UTC(b.year, b.month - 1, b.day);
  return Math.round((dayB - dayA) / (24 * MS_PER_HOUR));
}

/** `21:00` -> `9 PM`, `21:30` -> `9:30 PM`. Minutes are dropped when zero, as the frames do. */
export function formatClock(instant: Date | string): string {
  const { hour, minute } = toPkt(instant);
  const suffix = hour < 12 ? 'AM' : 'PM';
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return minute === 0
    ? `${twelve} ${suffix}`
    : `${twelve}:${String(minute).padStart(2, '0')} ${suffix}`;
}

/** Parses a `HH:mm` wall-clock string into minutes past midnight. */
export function parseClock(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + (minutes ?? 0);
}

export interface SlotLabelOptions {
  /** Abbreviates the weekday: `Sat, 9 PM` instead of `Saturday, 9 PM`. */
  abbreviateWeekday?: boolean;
  now?: Date;
}

/**
 * The compact card format. A full date ("Wed, 26 Aug, 10:00 pm") overflows the card's
 * 176px text column, so cards get the shortened form instead — docs/07 §6, deviation 5.
 *
 * Today after 5 PM reads "Tonight", because that is what a 9 PM slot is to the player.
 */
export function formatSlotShort(instant: Date | string, options: SlotLabelOptions = {}): string {
  const { abbreviateWeekday = false, now = new Date() } = options;
  const parts = toPkt(instant);
  const dayDelta = pktDayDifference(now, instant);
  const time = formatClock(instant);

  if (dayDelta === 0) return `${parts.hour >= 17 ? 'Tonight' : 'Today'}, ${time}`;
  if (dayDelta === 1) return `Tomorrow, ${time}`;

  if (dayDelta > 1 && dayDelta < 7) {
    const weekday = WEEKDAYS[parts.weekday];
    return `${abbreviateWeekday ? weekday.slice(0, 3) : weekday}, ${time}`;
  }

  return `${parts.day} ${MONTHS[parts.month - 1]}, ${time}`;
}

/** `2 min ago`, `10 min ago`, `3 hr ago`, `Yesterday`, `2 days ago` — the Chats frame's scale. */
export function formatRelative(instant: Date | string, now: Date = new Date()): string {
  const then = typeof instant === 'string' ? new Date(instant) : instant;
  const minutes = Math.floor((now.getTime() - then.getTime()) / MS_PER_MINUTE);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24 && pktDayDifference(then, now) === 0) return `${hours} hr ago`;

  const days = pktDayDifference(then, now);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;

  const parts = toPkt(then);
  return `${parts.day} ${MONTHS[parts.month - 1]}`;
}

/** `mm:ss`, for the checkout hold countdown. */
export function formatCountdown(secondsRemaining: number): string {
  const clamped = Math.max(0, Math.floor(secondsRemaining));
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** `09:00` -> `9 AM`, `14:30` -> `2:30 PM`. For venue opening hours, which are wall-clock. */
export function formatWallClock(value: string): string {
  const [hours, minutes] = value.split(':').map(Number);
  const suffix = hours < 12 ? 'AM' : 'PM';
  const twelve = hours % 12 === 0 ? 12 : hours % 12;
  return minutes
    ? `${twelve}:${String(minutes).padStart(2, '0')} ${suffix}`
    : `${twelve} ${suffix}`;
}

/**
 * Whole seconds from `now` until `instant`, floored at zero.
 *
 * Derived from an absolute deadline rather than a decrementing counter: timers are
 * suspended while an app is backgrounded, and a counter would resume showing time that
 * has already passed.
 */
export function secondsUntil(instant: Date | string | number, now: number = Date.now()): number {
  const deadline =
    typeof instant === 'number'
      ? instant
      : (typeof instant === 'string' ? new Date(instant) : instant).getTime();
  if (Number.isNaN(deadline)) return 0;
  return Math.max(0, Math.floor((deadline - now) / 1000));
}

/**
 * Opening hours as a player would read them.
 *
 * A venue open around the clock stores `00:00`-`23:59`, which renders as a nonsense range;
 * several Lahore futsal arenas genuinely run 24/7 (docs/01 §2), so that case gets its own
 * wording rather than a literal transcription of the field.
 */
export function formatOpeningHours(opensAt: string, closesAt: string): string {
  const opens = parseClock(opensAt);
  const closes = parseClock(closesAt);
  if (opens === 0 && closes >= 23 * 60 + 59) return 'Open 24 hours';
  return `Open ${formatWallClock(opensAt)} – ${formatWallClock(closesAt)}`;
}

/** Hours from `now` until `instant`; negative once the instant has passed. */
export function hoursUntil(instant: Date | string, now: Date = new Date()): number {
  const then = typeof instant === 'string' ? new Date(instant) : instant;
  return (then.getTime() - now.getTime()) / MS_PER_HOUR;
}
