import { modelFamilyOf } from "./model.ts";
import { dailyWindowKeyOf, hourOf, UTC_TIME_ZONE } from "./time.ts";
import {
  type BucketStat,
  type DailyWindowCostStat,
  NO_CHARGE_KIND,
  type Summary,
  type UsageEvent,
} from "./types.ts";

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
 * Model keys are the identifiers reported by the Usage Export. Use
 * `byModelFamily` for the coarse Model Family view and this function for the
 * Model-level detail inside one Model Family.
 */
export function byModel(events: UsageEvent[]): BucketStat[] {
  return bucketBy(events, (e) => e.model).sort((a, b) => b.cost - a.cost);
}

/**
 * Groups events by Model Family, ordered by Cost descending.
 *
 * Model Families collapse variant attributes (reasoning effort, thinking,
 * fast mode) and group Auto (Cursor Router) usage under one `Auto` key, so
 * charts stay readable when exports contain many Model variants.
 */
export function byModelFamily(events: UsageEvent[]): BucketStat[] {
  return bucketBy(events, (e) => modelFamilyOf(e.model)).sort((a, b) => b.cost - a.cost);
}

/**
 * Filters Usage Events to a single Model Family.
 *
 * Use this to drill from a Model Family breakdown into the Models it
 * contains, such as the actual Models routed by Auto (Cursor Router).
 */
export function eventsInModelFamily(events: UsageEvent[], family: string): UsageEvent[] {
  return events.filter((e) => modelFamilyOf(e.model) === family);
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

function byDailyWindowAndKey(
  events: UsageEvent[],
  keyOf: (e: UsageEvent) => string,
  timeZone: string,
  startHour: number,
): DailyWindowCostStat[] {
  const dailyWindows = new Map<string, DailyWindowCostStat>();
  for (const e of events) {
    const dailyWindow = dailyWindowKeyOf(e.date, timeZone, startHour);
    let d = dailyWindows.get(dailyWindow);
    if (!d) {
      d = { dailyWindow, costByKey: {}, totalCost: 0 };
      dailyWindows.set(dailyWindow, d);
    }
    const key = keyOf(e);
    d.costByKey[key] = (d.costByKey[key] ?? 0) + e.cost;
    d.totalCost += e.cost;
  }
  return [...dailyWindows.values()].sort((a, b) => a.dailyWindow.localeCompare(b.dailyWindow));
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
): DailyWindowCostStat[] {
  return byDailyWindowAndKey(events, (e) => e.model, timeZone, startHour);
}

/**
 * Builds Daily-Window-by-Model-Family cost buckets for stacked charts.
 *
 * This is the Model Family variant of `byDailyWindowAndModel`; `costByKey`
 * is keyed by Model Family so stacked Daily Window charts stay readable.
 */
export function byDailyWindowAndModelFamily(
  events: UsageEvent[],
  timeZone = UTC_TIME_ZONE,
  startHour = 0,
): DailyWindowCostStat[] {
  return byDailyWindowAndKey(events, (e) => modelFamilyOf(e.model), timeZone, startHour);
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
