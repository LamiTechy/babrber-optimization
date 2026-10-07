import { formatInTimeZone } from "date-fns-tz";
import OpeningHours from "opening_hours";
import { SITE_TIMEZONE } from "@/lib/config";

/**
 * Opening-hours logic. Every evaluation happens in Africa/Lagos — never in the
 * device or server timezone.
 *
 * Conventions:
 * - `WeekHours` has 7 entries indexed by weekday, 0 = Sunday … 6 = Saturday
 *   (the same index JavaScript's `Date#getDay()` returns).
 * - A range where `close <= open` means the shop closes after midnight.
 * - A day with no ranges is closed all day.
 */

export type HourRange = { open: string; close: string };
export type WeekHours = HourRange[][];
export type StatusState = "open" | "soon" | "closed" | "unknown";

export type HoursStatus = {
  isOpen: boolean;
  state: StatusState;
  label: string;
  /** ISO instant of the next state change (open → close, or closed → open). */
  nextChange: string | null;
};

export type ShopHoursInput = {
  hoursSource: "manual" | "osm" | "unknown";
  /** Manual weekly hours (7 entries, 0 = Sunday). */
  days?: WeekHours | null;
  /** Raw OSM `opening_hours` tag, kept even when it cannot be parsed. */
  osmOpeningHours?: string | null;
  override?: { status: "open" | "closed"; until: Date | null } | null;
};

const CLOSE_SOON_MINUTES = 30;
const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_MS = 86_400_000;

/* ------------------------------------------------------------------ *
 * Timezone helpers
 * ------------------------------------------------------------------ */

export type WallClock = {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number; // 0-23
  minute: number;
  dayOfWeek: number; // 0 = Sunday
  /** Minutes elapsed since Lagos midnight of that day. */
  minutes: number;
};

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timeZone: string): Intl.DateTimeFormat {
  let fmt = formatterCache.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatterCache.set(timeZone, fmt);
  }
  return fmt;
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/** Wall-clock fields of an instant in the given timezone. */
export function wallClock(date: Date, timeZone: string = SITE_TIMEZONE): WallClock {
  const parts: Record<string, string> = {};
  for (const part of getFormatter(timeZone).formatToParts(date)) {
    if (part.type !== "literal") parts[part.type] = part.value;
  }
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  const hour = Number(parts.hour) % 24;
  const minute = Number(parts.minute);
  return {
    year,
    month,
    day,
    hour,
    minute,
    dayOfWeek: WEEKDAY_INDEX[parts.weekday] ?? 0,
    minutes: hour * 60 + minute,
  };
}

/** UTC offset in ms of a timezone at a given instant. */
export function tzOffsetMs(date: Date, timeZone: string = SITE_TIMEZONE): number {
  const w = wallClock(date, timeZone);
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, 0);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** Real instant of midnight (in `timeZone`) for the day the instant falls on. */
export function startOfZonedDay(date: Date, timeZone: string = SITE_TIMEZONE): Date {
  const w = wallClock(date, timeZone);
  const midnightUtc = Date.UTC(w.year, w.month - 1, w.day, 0, 0, 0);
  return new Date(midnightUtc - tzOffsetMs(date, timeZone));
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

/** Format an instant as Lagos wall time, e.g. `9:00 PM`. */
export function formatZonedTime(date: Date, timeZone: string = SITE_TIMEZONE): string {
  return formatInTimeZone(date, timeZone, "h:mm a");
}

/** `08:30` / `8:30` → 510. Returns NaN for junk. */
export function parseHm(hm: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hm.trim());
  if (!match) return Number.NaN;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 24 || m > 59) return Number.NaN;
  return h * 60 + m;
}

export function isValidHm(hm: string): boolean {
  return !Number.isNaN(parseHm(hm));
}

export function minutesToHm(minutes: number): string {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Start day (index 0 = Sunday) of a weekday offset from `from`. */
function weekdayOf(date: Date): number {
  return wallClock(date).dayOfWeek;
}

/* ------------------------------------------------------------------ *
 * Manual weekly hours
 * ------------------------------------------------------------------ */

function activeNow(
  days: WeekHours,
  dayOfWeek: number,
  minutes: number,
): { open: boolean; closeAt: number } {
  let open = false;
  let closeAt = Number.POSITIVE_INFINITY;

  const push = (start: number, rawEnd: number) => {
    const end = rawEnd <= start ? rawEnd + 1440 : rawEnd;
    if (minutes >= start && minutes < end) {
      open = true;
      if (end < closeAt) closeAt = end;
    }
  };

  for (const range of days[dayOfWeek] ?? []) {
    const start = parseHm(range.open);
    const end = parseHm(range.close);
    if (Number.isNaN(start) || Number.isNaN(end)) continue;
    push(start, end);
  }

  // A shift that started yesterday and closes after midnight is still running.
  for (const range of days[(dayOfWeek + 6) % 7] ?? []) {
    const start = parseHm(range.open);
    const end = parseHm(range.close);
    if (Number.isNaN(start) || Number.isNaN(end)) continue;
    const extended = end <= start ? end + 1440 : end;
    if (extended > 1440 && minutes < extended - 1440) {
      open = true;
      const spillClose = extended - 1440;
      if (spillClose < closeAt) closeAt = spillClose;
    }
  }

  return { open, closeAt };
}

/** Status from a manual weekly table, evaluated in Africa/Lagos. */
export function computeManualStatus(days: WeekHours, now: Date): HoursStatus {
  const { dayOfWeek, minutes } = wallClock(now);
  const todayStart = startOfZonedDay(now);

  const hasAnyHours = days.some((day) => day && day.length > 0);
  if (!hasAnyHours) {
    return {
      isOpen: false,
      state: "unknown",
      label: "Hours not listed · Call to confirm",
      nextChange: null,
    };
  }

  const active = activeNow(days, dayOfWeek, minutes);

  if (active.open) {
    const closeDate = addMinutes(todayStart, active.closeAt);
    const minutesLeft = active.closeAt - minutes;
    if (minutesLeft < CLOSE_SOON_MINUTES) {
      return {
        isOpen: true,
        state: "soon",
        label: `Closing soon · Closes in ${minutesLeft} min`,
        nextChange: closeDate.toISOString(),
      };
    }
    return {
      isOpen: true,
      state: "open",
      label: `Open now · Closes ${formatZonedTime(closeDate)}`,
      nextChange: closeDate.toISOString(),
    };
  }

  // Next opening: later today first, then the next seven days.
  let openAt: { offsetDays: number; minutes: number } | null = null;

  for (const range of days[dayOfWeek] ?? []) {
    const start = parseHm(range.open);
    if (Number.isNaN(start)) continue;
    if (start > minutes && (!openAt || start < openAt.minutes)) {
      openAt = { offsetDays: 0, minutes: start };
    }
  }

  if (!openAt) {
    for (let offset = 1; offset <= 7 && !openAt; offset++) {
      let earliest = Number.POSITIVE_INFINITY;
      for (const range of days[(dayOfWeek + offset) % 7] ?? []) {
        const start = parseHm(range.open);
        if (!Number.isNaN(start) && start < earliest) earliest = start;
      }
      if (earliest !== Number.POSITIVE_INFINITY) {
        openAt = { offsetDays: offset, minutes: earliest };
      }
    }
  }

  if (!openAt) {
    return { isOpen: false, state: "closed", label: "Closed", nextChange: null };
  }

  const openDate = addMinutes(todayStart, openAt.offsetDays * 1440 + openAt.minutes);
  const when =
    openAt.offsetDays === 0
      ? "today"
      : openAt.offsetDays === 1
        ? "tomorrow"
        : WEEKDAY_SHORT[(dayOfWeek + openAt.offsetDays) % 7];

  return {
    isOpen: false,
    state: "closed",
    label: `Closed · Opens ${when} ${formatZonedTime(openDate)}`,
    nextChange: openDate.toISOString(),
  };
}

/* ------------------------------------------------------------------ *
 * OpenStreetMap `opening_hours`
 * ------------------------------------------------------------------ */

/**
 * The `opening_hours` library evaluates in the *system* timezone. To make it
 * evaluate in Africa/Lagos we hand it an instant whose system-local wall clock
 * equals the real Lagos wall clock, and translate results back afterwards.
 */
export function toEvaluationInstant(now: Date, timeZone: string = SITE_TIMEZONE): Date {
  const systemOffsetMs = -now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() + tzOffsetMs(now, timeZone) - systemOffsetMs);
}

export function fromEvaluationInstant(
  shifted: Date,
  timeZone: string = SITE_TIMEZONE,
): Date {
  const systemOffsetMs = -shifted.getTimezoneOffset() * 60_000;
  return new Date(shifted.getTime() - tzOffsetMs(shifted, timeZone) + systemOffsetMs);
}

function makeOpeningHours(raw: string): OpeningHours | null {
  const value = raw.trim();
  if (!value) return null;
  try {
    const oh = new OpeningHours(value);
    const warnings = oh.getWarnings();
    const fatal = warnings.some((w) => /nothing useful|no information|could not/i.test(w));
    if (fatal) return null;
    return oh;
  } catch {
    return null;
  }
}

/** Can this OSM `opening_hours` string be understood? */
export function isParsableOsmHours(raw: string): boolean {
  return makeOpeningHours(raw) !== null;
}

type OsmInterval = [Date, Date, boolean, string | undefined];

function openIntervals(oh: OpeningHours, from: Date, to: Date): OsmInterval[] | null {
  try {
    return oh.getOpenIntervals(from, to) as OsmInterval[];
  } catch {
    return null;
  }
}

/** Status straight from an OSM `opening_hours` string, evaluated in Lagos. */
export function computeOsmStatus(raw: string, now: Date): HoursStatus | null {
  const oh = makeOpeningHours(raw);
  if (!oh) return null;

  const from = toEvaluationInstant(new Date(now.getTime() - 2 * DAY_MS));
  const until = toEvaluationInstant(new Date(now.getTime() + 8 * DAY_MS));
  const probe = toEvaluationInstant(now);

  const intervals = openIntervals(oh, from, until);
  if (!intervals) return null;

  const current = intervals.find(([start, end]) => start <= probe && probe < end);
  if (current) {
    const closeDate = fromEvaluationInstant(current[1]);
    const minutesLeft = Math.max(
      1,
      Math.round((closeDate.getTime() - now.getTime()) / 60_000),
    );
    if (minutesLeft < CLOSE_SOON_MINUTES) {
      return {
        isOpen: true,
        state: "soon",
        label: `Closing soon · Closes in ${minutesLeft} min`,
        nextChange: closeDate.toISOString(),
      };
    }
    return {
      isOpen: true,
      state: "open",
      label: `Open now · Closes ${formatZonedTime(closeDate)}`,
      nextChange: closeDate.toISOString(),
    };
  }

  const next = intervals.find(([start]) => start > probe);
  if (!next) {
    return { isOpen: false, state: "closed", label: "Closed", nextChange: null };
  }

  const openDate = fromEvaluationInstant(next[0]);
  const nowW = wallClock(now);
  const openW = wallClock(openDate);
  const dayDelta = Math.round(
    (Date.UTC(openW.year, openW.month - 1, openW.day) -
      Date.UTC(nowW.year, nowW.month - 1, nowW.day)) /
      DAY_MS,
  );
  const when =
    dayDelta === 0 ? "today" : dayDelta === 1 ? "tomorrow" : WEEKDAY_SHORT[openW.dayOfWeek];

  return {
    isOpen: false,
    state: "closed",
    label: `Closed · Opens ${when} ${formatZonedTime(openDate)}`,
    nextChange: openDate.toISOString(),
  };
}

/**
 * Best-effort weekly table derived from an OSM tag, used for the hours table on
 * the shop page. A seven-day window guarantees every weekday appears exactly
 * once, and starting one day early keeps after-midnight shifts attached to the
 * day they began. Returns null when the tag cannot be parsed.
 */
export function osmWeekHours(raw: string, now: Date): WeekHours | null {
  const oh = makeOpeningHours(raw);
  if (!oh) return null;

  const from = new Date(startOfZonedDay(now).getTime() - DAY_MS);
  const to = new Date(from.getTime() + 7 * DAY_MS);

  const intervals = openIntervals(oh, toEvaluationInstant(from), toEvaluationInstant(to));
  if (!intervals) return null;

  const days: WeekHours = [[], [], [], [], [], [], []];
  const fullDayRange: HourRange = { open: "00:00", close: "00:00" };

  for (const [rawStart, rawEnd] of intervals) {
    const start = fromEvaluationInstant(rawStart);
    const end = fromEvaluationInstant(rawEnd);
    if (end <= from || start >= to) continue;

    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
      const dayStart = addMinutes(from, dayIndex * 1440);
      const dayEnd = addMinutes(dayStart, 1440);
      if (end <= dayStart || start >= dayEnd) continue;

      const weekday = weekdayOf(dayStart);

      if (start <= dayStart && end >= dayEnd) {
        // The shop is open the whole day (e.g. 24/7).
        if (!days[weekday].some((r) => r.open === "00:00" && r.close === "00:00")) {
          days[weekday].push({ ...fullDayRange });
        }
        continue;
      }

      if (start < dayStart) {
        // Continuation of a shift that opened on an earlier day: correct the
        // closing time stored on that day.
        const previousWeekday = (weekday + 6) % 7;
        const openHm = minutesToHm(wallClock(start).minutes);
        const closeHm = minutesToHm(wallClock(end).minutes);
        const target = days[previousWeekday].find((r) => r.open === openHm);
        if (target) target.close = closeHm;
        continue;
      }

      const openHm = minutesToHm(wallClock(start).minutes);
      const closesAfterMidnight = end >= dayEnd;
      const closeHm = closesAfterMidnight ? "00:00" : minutesToHm(wallClock(end).minutes);
      if (!days[weekday].some((r) => r.open === openHm)) {
        days[weekday].push({ open: openHm, close: closeHm });
      }
    }
  }

  for (const day of days) day.sort((a, b) => parseHm(a.open) - parseHm(b.open));
  return days;
}

/* ------------------------------------------------------------------ *
 * Public entry point
 * ------------------------------------------------------------------ */

export function computeShopStatus(input: ShopHoursInput, now: Date = new Date()): HoursStatus {
  if (input.override) {
    const active = !input.override.until || input.override.until.getTime() > now.getTime();
    if (active) {
      const suffix = input.override.until
        ? ` · until ${formatZonedTime(input.override.until)}`
        : "";
      if (input.override.status === "closed") {
        return {
          isOpen: false,
          state: "closed",
          label: `Closed · owner set${suffix}`,
          nextChange: input.override.until?.toISOString() ?? null,
        };
      }
      return {
        isOpen: true,
        state: "open",
        label: `Open now · owner set${suffix}`,
        nextChange: input.override.until?.toISOString() ?? null,
      };
    }
  }

  if (input.hoursSource === "manual" && input.days) {
    return computeManualStatus(input.days, now);
  }

  if (input.hoursSource === "osm" && input.osmOpeningHours) {
    const status = computeOsmStatus(input.osmOpeningHours, now);
    if (status) return status;
    // Tag present but unparseable: show it as-is with a neutral badge.
    return { isOpen: false, state: "unknown", label: input.osmOpeningHours, nextChange: null };
  }

  return {
    isOpen: false,
    state: "unknown",
    label: "Hours not listed · Call to confirm",
    nextChange: null,
  };
}

/**
 * Sort rank for the "Open now first" ordering: open shops first, then shops
 * with known hours that are closed, then shops whose hours we do not know.
 */
export function statusRank(status: HoursStatus): number {
  if (status.state === "open" || status.state === "soon") return 0;
  if (status.state === "closed") return 1;
  return 2;
}
