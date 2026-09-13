import type { AnalysisContext, UsageEvent } from "./types.ts";

export const UTC_TIME_ZONE = "UTC";

export const DEFAULT_ANALYSIS_CONTEXT: AnalysisContext = {
  timeZone: UTC_TIME_ZONE,
  startHour: 0,
};

/**
 * Fills omitted Analysis Context fields with UTC and a midnight start hour.
 *
 * Core grouping functions accept a partial context so tests and callers can
 * override only the field they care about.
 */
export function resolveAnalysisContext(ctx: Partial<AnalysisContext> = {}): AnalysisContext {
  return {
    timeZone: ctx.timeZone ?? DEFAULT_ANALYSIS_CONTEXT.timeZone,
    startHour: ctx.startHour ?? DEFAULT_ANALYSIS_CONTEXT.startHour,
  };
}

/**
 * Returns the environment's default Analysis Time Zone.
 *
 * This is the fallback used when the caller has not chosen a time zone
 * explicitly. UTC is used only when the runtime cannot report a local zone.
 */
export function defaultAnalysisTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || UTC_TIME_ZONE;
}

/**
 * Checks whether a string is accepted by `Intl.DateTimeFormat` as an IANA time zone.
 *
 * Use this before accepting CLI or URL state; invalid zones should not silently
 * change how Daily Windows and Hours are grouped.
 */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

const dateTimeFormatters = new Map<string, Intl.DateTimeFormat>();

function dateTimeFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = dateTimeFormatters.get(timeZone);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  dateTimeFormatters.set(timeZone, formatter);
  return formatter;
}

/**
 * Returns `Intl` date-time parts using a cached formatter.
 *
 * Grouping caches compact date/hour values separately to avoid retaining a
 * full parts map for every Usage Event.
 */
export function dateTimeParts(
  date: Date,
  timeZone: string,
): Map<Intl.DateTimeFormatPartTypes, string> {
  return new Map(
    dateTimeFormatter(timeZone)
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
}

/**
 * Checks whether a Daily Window start hour is representable on a 24-hour clock.
 */
export function isValidStartHour(startHour: number): boolean {
  return Number.isInteger(startHour) && startHour >= 0 && startHour <= 23;
}

const DAILY_WINDOW_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Checks whether a string is a `YYYY-MM-DD` Daily Window Key.
 */
export function isValidDailyWindowKey(value: string): boolean {
  return DAILY_WINDOW_KEY_PATTERN.test(value);
}

function assertStartHour(startHour: number): void {
  if (!isValidStartHour(startHour)) {
    throw new Error(`Invalid Daily Window start hour: ${startHour}`);
  }
}

type LocalCalendar = {
  timestamp: number;
  timeZone: string;
  dateKey: string;
  hour: string;
  previousDateKey?: string;
};

// Weak keys release the cache with the loaded events. Retain only the latest
// time zone per Date, and check the timestamp because Date objects are mutable.
const localCalendars = new WeakMap<Date, LocalCalendar>();

function localDateKeyAndHour(date: Date, timeZone: string): LocalCalendar {
  const timestamp = date.getTime();
  const cached = localCalendars.get(date);
  if (cached?.timestamp === timestamp && cached.timeZone === timeZone) return cached;
  const parts = dateTimeParts(date, timeZone);
  const calendar = {
    timestamp,
    timeZone,
    dateKey: [parts.get("year"), parts.get("month"), parts.get("day")].join("-"),
    hour: parts.get("hour") ?? "00",
  };
  localCalendars.set(date, calendar);
  return calendar;
}

function dateParts(dateKey: string): { year: number; month: number; date: number } {
  const [year, month, date] = dateKey.split("-").map(Number);
  if (year === undefined || month === undefined || date === undefined) {
    throw new Error(`Invalid Daily Window Key: ${dateKey}`);
  }
  return { year, month, date };
}

function formatUtcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(dateKey: string, days: number): string {
  const { year, month, date } = dateParts(dateKey);
  return formatUtcDate(new Date(Date.UTC(year, month - 1, date) + days * 86_400_000));
}

/**
 * Lists Daily Window Keys from `first` through `last`, inclusive.
 *
 * Use this to fill empty calendar days on a chart without treating those days
 * as Active Daily Windows. Keys are calendar dates, so this walks UTC dates.
 */
export function dailyWindowKeysInRange(first: string, last: string): string[] {
  if (first > last) return [];
  const keys: string[] = [];
  for (let key = first; key <= last; key = addDays(key, 1)) {
    keys.push(key);
  }
  return keys;
}

/**
 * Returns the Daily Window Key for an absolute timestamp.
 *
 * The key is based on the local date at the start of the Daily Window. A
 * midnight start hour preserves the usual calendar-aligned grouping.
 */
export function dailyWindowKeyOf(date: Date, ctx: Partial<AnalysisContext> = {}): string {
  const { timeZone, startHour } = resolveAnalysisContext(ctx);
  assertStartHour(startHour);
  const calendar = localDateKeyAndHour(date, timeZone);
  return Number(calendar.hour) < startHour
    ? (calendar.previousDateKey ??= addDays(calendar.dateKey, -1))
    : calendar.dateKey;
}

/**
 * Returns the Hour for an absolute timestamp in the selected Analysis Time Zone.
 *
 * The result is a two-digit clock hour (`"00"` through `"23"`) suitable for
 * chronological hourly buckets.
 */
export function hourOf(date: Date, ctx: Partial<AnalysisContext> = {}): string {
  const { timeZone } = resolveAnalysisContext(ctx);
  return localDateKeyAndHour(date, timeZone).hour;
}

/**
 * Returns clock hours ordered from a Daily Window start hour.
 *
 * Use this for charts that should read in Daily Window order rather than
 * midnight-first clock order.
 */
export function orderedHours(ctx: Partial<AnalysisContext> = {}): string[] {
  const { startHour } = resolveAnalysisContext(ctx);
  assertStartHour(startHour);
  return Array.from({ length: 24 }, (_, i) => String((startHour + i) % 24).padStart(2, "0"));
}

/**
 * Filters Usage Events to a single Daily Window.
 */
export function eventsInDailyWindow(
  events: UsageEvent[],
  dailyWindow: string,
  ctx: Partial<AnalysisContext> = {},
): UsageEvent[] {
  return events.filter((e) => dailyWindowKeyOf(e.date, ctx) === dailyWindow);
}

/**
 * Returns the Daily Window Key containing the latest event in the analysis set.
 */
export function latestDailyWindowKey(
  events: UsageEvent[],
  ctx: Partial<AnalysisContext> = {},
): string | null {
  let latest: UsageEvent | undefined;
  for (const event of events) {
    if (!latest || event.date.getTime() > latest.date.getTime()) latest = event;
  }
  return latest ? dailyWindowKeyOf(latest.date, ctx) : null;
}
