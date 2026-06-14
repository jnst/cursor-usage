import {
  NO_CHARGE_KIND,
  type BucketStat,
  type DayModelStat,
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
 * change how Days and Hours are grouped.
 */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function timePart(
  date: Date,
  timeZone: string,
  part: "year" | "month" | "day" | "hour",
): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return parts.find((p) => p.type === part)?.value ?? "";
}

/**
 * Returns the Day for an absolute timestamp in the selected Analysis Time Zone.
 *
 * Day is a domain concept, not a raw UTC date. Passing the same timestamp with
 * a different time zone may intentionally produce a different `YYYY-MM-DD`.
 */
export function dayOf(date: Date, timeZone = UTC_TIME_ZONE): string {
  return [
    timePart(date, timeZone, "year"),
    timePart(date, timeZone, "month"),
    timePart(date, timeZone, "day"),
  ].join("-");
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
 * Filters Usage Events to a single Day in the selected Analysis Time Zone.
 *
 * The `day` argument is interpreted in that time zone. It is not a UTC date
 * unless the selected time zone is UTC.
 */
export function onDay(
  events: UsageEvent[],
  day: string,
  timeZone = UTC_TIME_ZONE,
): UsageEvent[] {
  return events.filter((e) => dayOf(e.date, timeZone) === day);
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
 * Date Range and Active Day count are derived from Billable Events already
 * selected by the caller, grouped in the selected Analysis Time Zone.
 */
export function summarize(
  events: UsageEvent[],
  timeZone = UTC_TIME_ZONE,
): Summary {
  let totalCost = 0;
  let totalTokens = 0;
  let maxModeCount = 0;
  const days = new Set<string>();
  const users = new Set<string>();
  const models = new Set<string>();

  for (const e of events) {
    totalCost += e.cost;
    totalTokens += e.totalTokens;
    if (e.maxMode) maxModeCount++;
    days.add(dayOf(e.date, timeZone));
    users.add(e.user);
    models.add(e.model);
  }

  const sortedDays = [...days].sort();
  return {
    totalCost,
    totalTokens,
    eventCount: events.length,
    firstDay: sortedDays[0] ?? null,
    lastDay: sortedDays[sortedDays.length - 1] ?? null,
    dayCount: days.size,
    avgCostPerActiveDay: days.size > 0 ? totalCost / days.size : 0,
    maxModeRatio: events.length > 0 ? maxModeCount / events.length : 0,
    userCount: users.size,
    modelCount: models.size,
  };
}

function bucketBy(
  events: UsageEvent[],
  keyFn: (e: UsageEvent) => string,
): BucketStat[] {
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
 * Groups events by Day in the selected Analysis Time Zone.
 *
 * Returned buckets are chronological so they can be used directly for time
 * series charts and terminal output.
 */
export function byDay(
  events: UsageEvent[],
  timeZone = UTC_TIME_ZONE,
): BucketStat[] {
  return bucketBy(events, (e) => dayOf(e.date, timeZone)).sort((a, b) =>
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
export function byHour(
  events: UsageEvent[],
  timeZone = UTC_TIME_ZONE,
): BucketStat[] {
  return bucketBy(events, (e) => hourOf(e.date, timeZone)).sort((a, b) =>
    a.key.localeCompare(b.key),
  );
}

/**
 * Builds Day-by-Model cost buckets for stacked day charts.
 *
 * Days are derived in the selected Analysis Time Zone, and model costs are kept
 * separate so charts can show both daily totals and model composition.
 */
export function byDayAndModel(
  events: UsageEvent[],
  timeZone = UTC_TIME_ZONE,
): DayModelStat[] {
  const days = new Map<string, DayModelStat>();
  for (const e of events) {
    const day = dayOf(e.date, timeZone);
    let d = days.get(day);
    if (!d) {
      d = { day, costByModel: {}, totalCost: 0 };
      days.set(day, d);
    }
    d.costByModel[e.model] = (d.costByModel[e.model] ?? 0) + e.cost;
    d.totalCost += e.cost;
  }
  return [...days.values()].sort((a, b) => a.day.localeCompare(b.day));
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
