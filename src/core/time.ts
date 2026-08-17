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
 * Returns cached `Intl` date-time parts for an absolute timestamp.
 *
 * Display formatters and Daily Window keying share this cache so a timestamp
 * is not formatted repeatedly per field.
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

function localDateKeyAndHour(date: Date, timeZone: string): { dateKey: string; hour: number } {
  const parts = dateTimeParts(date, timeZone);
  return {
    dateKey: [parts.get("year"), parts.get("month"), parts.get("day")].join("-"),
    hour: Number(parts.get("hour") ?? 0),
  };
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
 * Enumerates inclusive Daily Window Keys from first to last in calendar order.
 *
 * Keys are treated as civil `YYYY-MM-DD` dates. Callers should pass keys that
 * already came from Daily Window grouping rather than arbitrary strings.
 */
export function dailyWindowKeysInRange(first: string, last: string): string[] {
  if (first > last) return [];
  const keys = [first];
  let current = first;
  while (current < last) {
    current = addDays(current, 1);
    keys.push(current);
  }
  return keys;
}

/**
 * Returns the civil weekday of a Daily Window Key (0 = Sunday, 6 = Saturday).
 *
 * The key is a calendar date, so the weekday does not depend on the Analysis
 * Time Zone. Use this for weekend shading on time-series charts.
 */
export function weekdayOfDailyWindowKey(dailyWindow: string): number {
  const { year, month, date } = dateParts(dailyWindow);
  return new Date(Date.UTC(year, month - 1, date)).getUTCDay();
}

/**
 * Returns true when a Daily Window Key falls on Saturday or Sunday.
 */
export function isWeekendDailyWindowKey(dailyWindow: string): boolean {
  const weekday = weekdayOfDailyWindowKey(dailyWindow);
  return weekday === 0 || weekday === 6;
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
  const { dateKey, hour } = localDateKeyAndHour(date, timeZone);
  return hour < startHour ? addDays(dateKey, -1) : dateKey;
}

/**
 * Returns the Hour for an absolute timestamp in the selected Analysis Time Zone.
 *
 * The result is a two-digit clock hour (`"00"` through `"23"`) suitable for
 * chronological hourly buckets.
 */
export function hourOf(date: Date, ctx: Partial<AnalysisContext> = {}): string {
  const { timeZone } = resolveAnalysisContext(ctx);
  return dateTimeParts(date, timeZone).get("hour") ?? "";
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
