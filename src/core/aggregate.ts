import {
  type BucketStat,
  type DailyWindowModelStat,
  NO_CHARGE_KIND,
  type Summary,
  type UsageEvent,
} from "./types.ts";

export const UTC_TIME_ZONE = "UTC";

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
    hourCycle: "h23",
  });
  dateTimeFormatters.set(timeZone, formatter);
  return formatter;
}

function dateTimeParts(date: Date, timeZone: string): Map<Intl.DateTimeFormatPartTypes, string> {
  return new Map(
    dateTimeFormatter(timeZone)
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
}

function timePart(date: Date, timeZone: string, part: "year" | "month" | "day" | "hour"): string {
  const parts = dateTimeParts(date, timeZone);
  return parts.get(part) ?? "";
}

/**
 * Checks whether a Daily Window start hour is representable on a 24-hour clock.
 */
export function isValidStartHour(startHour: number): boolean {
  return Number.isInteger(startHour) && startHour >= 0 && startHour <= 23;
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
 * Returns the Daily Window Key for an absolute timestamp.
 *
 * The key is based on the local date at the start of the Daily Window. A
 * midnight start hour preserves the usual calendar-aligned grouping.
 */
export function dailyWindowKeyOf(date: Date, timeZone = UTC_TIME_ZONE, startHour = 0): string {
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
export function hourOf(date: Date, timeZone = UTC_TIME_ZONE): string {
  return timePart(date, timeZone, "hour");
}

/**
 * Returns clock hours ordered from a Daily Window start hour.
 *
 * Use this for charts that should read in Daily Window order rather than
 * midnight-first clock order.
 */
export function orderedHours(startHour = 0): string[] {
  assertStartHour(startHour);
  return Array.from({ length: 24 }, (_, i) => String((startHour + i) % 24).padStart(2, "0"));
}

/**
 * Filters Usage Events to a single Daily Window.
 */
export function eventsInDailyWindow(
  events: UsageEvent[],
  dailyWindow: string,
  timeZone = UTC_TIME_ZONE,
  startHour = 0,
): UsageEvent[] {
  return events.filter((e) => dailyWindowKeyOf(e.date, timeZone, startHour) === dailyWindow);
}

/**
 * Returns the Daily Window Key containing the latest event in the analysis set.
 */
export function latestDailyWindowKey(
  events: UsageEvent[],
  timeZone = UTC_TIME_ZONE,
  startHour = 0,
): string | null {
  const latest = [...events].sort((a, b) => b.date.getTime() - a.date.getTime())[0];
  return latest ? dailyWindowKeyOf(latest.date, timeZone, startHour) : null;
}

/**
 * Keeps only Billable Events for normal cost analysis.
 *
 * No Charge Events are still parsed from the Usage Export, but they are
 * excluded by default from cost-focused summaries and charts.
 */
export function billable(events: UsageEvent[]): UsageEvent[] {
  return events.filter((e) => e.kind !== NO_CHARGE_KIND);
}

/**
 * Computes top-level Metrics for the current analysis set.
 *
 * Daily Window Range and Active Daily Window count are derived from Billable
 * Events already selected by the caller, grouped in the selected Analysis Time Zone.
 */
export function summarize(events: UsageEvent[], timeZone = UTC_TIME_ZONE, startHour = 0): Summary {
  let totalCost = 0;
  let totalTokens = 0;
  let maxModeCount = 0;
  const dailyWindows = new Set<string>();
  const users = new Set<string>();
  const models = new Set<string>();

  for (const e of events) {
    totalCost += e.cost;
    totalTokens += e.totalTokens;
    if (e.maxMode) maxModeCount++;
    dailyWindows.add(dailyWindowKeyOf(e.date, timeZone, startHour));
    users.add(e.user);
    models.add(e.model);
  }

  const sortedDailyWindows = [...dailyWindows].sort();
  return {
    totalCost,
    totalTokens,
    eventCount: events.length,
    firstDailyWindow: sortedDailyWindows[0] ?? null,
    lastDailyWindow: sortedDailyWindows[sortedDailyWindows.length - 1] ?? null,
    dailyWindowCount: dailyWindows.size,
    avgCostPerActiveDailyWindow: dailyWindows.size > 0 ? totalCost / dailyWindows.size : 0,
    maxModeRatio: events.length > 0 ? maxModeCount / events.length : 0,
    userCount: users.size,
    modelCount: models.size,
  };
}

function bucketBy(events: UsageEvent[], keyFn: (e: UsageEvent) => string): BucketStat[] {
  const buckets = new Map<string, BucketStat>();
  for (const e of events) {
    const key = keyFn(e);
    let b = buckets.get(key);
    if (!b) {
      b = {
        key,
        cost: 0,
        totalTokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        cacheRead: 0,
        eventCount: 0,
      };
      buckets.set(key, b);
    }
    b.cost += e.cost;
    b.totalTokens += e.totalTokens;
    b.inputTokens += e.inputWithCacheWrite + e.inputWithoutCacheWrite;
    b.outputTokens += e.outputTokens;
    b.cacheRead += e.cacheRead;
    b.eventCount++;
  }
  return [...buckets.values()];
}

/**
 * Groups events by Daily Window in the selected Analysis Time Zone.
 *
 * Returned buckets are chronological so they can be used directly for time
 * series charts and terminal output.
 */
export function byDailyWindow(
  events: UsageEvent[],
  timeZone = UTC_TIME_ZONE,
  startHour = 0,
): BucketStat[] {
  return bucketBy(events, (e) => dailyWindowKeyOf(e.date, timeZone, startHour)).sort((a, b) =>
    a.key.localeCompare(b.key),
  );
}

/**
 * Groups events by User, ordered by Cost descending.
 *
 * User keys are the identifiers reported by the Usage Export; this function
 * does not normalize or map them to account records.
 */
export function byUser(events: UsageEvent[]): BucketStat[] {
  return bucketBy(events, (e) => e.user).sort((a, b) => b.cost - a.cost);
}

/**
 * Groups events by Model, ordered by Cost descending.
 *
 * Model keys are the identifiers reported by the Usage Export; Model Family
 * aggregation is intentionally not introduced here.
 */
export function byModel(events: UsageEvent[]): BucketStat[] {
  return bucketBy(events, (e) => e.model).sort((a, b) => b.cost - a.cost);
}

/**
 * Groups events by Kind, ordered by Cost descending.
 *
 * Kind is treated as a cost analysis axis, so its default ordering matches the
 * other cost-focused breakdowns.
 */
export function byKind(events: UsageEvent[]): BucketStat[] {
  return bucketBy(events, (e) => e.kind).sort((a, b) => b.cost - a.cost);
}

/**
 * Groups events by Hour in the selected Analysis Time Zone.
 *
 * Only hours that contain activity are returned. Callers that need a complete
 * 24-hour chart should fill missing hours explicitly.
 */
export function byHour(events: UsageEvent[], timeZone = UTC_TIME_ZONE): BucketStat[] {
  return bucketBy(events, (e) => hourOf(e.date, timeZone)).sort((a, b) =>
    a.key.localeCompare(b.key),
  );
}

/**
 * Builds Daily-Window-by-Model cost buckets for stacked Daily Window charts.
 *
 * Daily Windows are derived in the selected Analysis Time Zone, and model costs
 * are kept separate so charts can show both totals and model composition.
 */
export function byDailyWindowAndModel(
  events: UsageEvent[],
  timeZone = UTC_TIME_ZONE,
  startHour = 0,
): DailyWindowModelStat[] {
  const dailyWindows = new Map<string, DailyWindowModelStat>();
  for (const e of events) {
    const dailyWindow = dailyWindowKeyOf(e.date, timeZone, startHour);
    let d = dailyWindows.get(dailyWindow);
    if (!d) {
      d = { dailyWindow, costByModel: {}, totalCost: 0 };
      dailyWindows.set(dailyWindow, d);
    }
    d.costByModel[e.model] = (d.costByModel[e.model] ?? 0) + e.cost;
    d.totalCost += e.cost;
  }
  return [...dailyWindows.values()].sort((a, b) => a.dailyWindow.localeCompare(b.dailyWindow));
}

/**
 * Returns the highest-cost Usage Events.
 *
 * This is a relative High Cost view over the caller's current analysis set,
 * not a fixed cost threshold.
 */
export function topEvents(events: UsageEvent[], limit: number): UsageEvent[] {
  return [...events].sort((a, b) => b.cost - a.cost).slice(0, limit);
}
