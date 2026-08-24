import { modelFamilyOf } from "./model.ts";
import { dailyWindowKeyOf, dailyWindowKeysInRange, hourOf } from "./time.ts";
import {
  type AnalysisContext,
  type BucketStat,
  type DailyWindowCostStat,
  type Metric,
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

export interface EventFilters {
  includeNoCharge?: boolean;
  user?: string;
  modelFamily?: string;
}

/**
 * Applies the usual analysis filters: Billable Events, optional User, optional
 * Model Family.
 *
 * No Charge Events stay out unless `includeNoCharge` is set. Callers that need
 * the unfiltered User comparison set should omit `user`.
 */
export function filterEvents(events: UsageEvent[], filters: EventFilters = {}): UsageEvent[] {
  let out = filters.includeNoCharge ? events : billable(events);
  if (filters.user) out = out.filter((e) => e.user === filters.user);
  if (filters.modelFamily) out = eventsInModelFamily(out, filters.modelFamily);
  return out;
}

/**
 * Computes top-level Metrics for the current analysis set.
 *
 * Daily Window Range and Active Daily Window count are derived from Billable
 * Events already selected by the caller, grouped in the selected Analysis Time Zone.
 */
export function summarize(events: UsageEvent[], ctx: Partial<AnalysisContext> = {}): Summary {
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
    dailyWindows.add(dailyWindowKeyOf(e.date, ctx));
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

export function bucketMetric(bucket: BucketStat, metric: Metric): number {
  return metric === "tokens" ? bucket.totalTokens : bucket.cost;
}

export function eventMetric(event: UsageEvent, metric: Metric): number {
  return metric === "tokens" ? event.totalTokens : event.cost;
}

function sortByMetric(buckets: BucketStat[], metric: Metric): BucketStat[] {
  return buckets.sort((a, b) => bucketMetric(b, metric) - bucketMetric(a, metric));
}

/**
 * Groups events by Daily Window in the selected Analysis Time Zone.
 *
 * Returned buckets are chronological and include only Active Daily Windows.
 * Period charts should pass the result through `includeEmptyDailyWindows` so
 * idle days in the Daily Window Range still render as zero (ADR-010).
 */
export function byDailyWindow(
  events: UsageEvent[],
  ctx: Partial<AnalysisContext> = {},
): BucketStat[] {
  return bucketBy(events, (e) => dailyWindowKeyOf(e.date, ctx)).sort((a, b) =>
    a.key.localeCompare(b.key),
  );
}

/**
 * Groups events by User, ordered by the Selected Metric descending.
 *
 * User keys are the identifiers reported by the Usage Export; this function
 * does not normalize or map them to account records.
 */
export function byUser(events: UsageEvent[], metric: Metric = "cost"): BucketStat[] {
  return sortByMetric(
    bucketBy(events, (e) => e.user),
    metric,
  );
}

/**
 * Groups events by Model, ordered by the Selected Metric descending.
 *
 * Model keys are the identifiers reported by the Usage Export. Use
 * `byModelFamily` for the coarse Model Family view and this function for the
 * Model-level detail inside one Model Family.
 */
export function byModel(events: UsageEvent[], metric: Metric = "cost"): BucketStat[] {
  return sortByMetric(
    bucketBy(events, (e) => e.model),
    metric,
  );
}

/**
 * Groups events by Model Family, ordered by the Selected Metric descending.
 *
 * Model Families collapse variant attributes (reasoning effort, thinking,
 * fast mode) and group Auto (Cursor Router) usage under one `Auto` key, so
 * charts stay readable when exports contain many Model variants.
 */
export function byModelFamily(events: UsageEvent[], metric: Metric = "cost"): BucketStat[] {
  return sortByMetric(
    bucketBy(events, (e) => modelFamilyOf(e.model)),
    metric,
  );
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
 * Groups events by Kind, ordered by the Selected Metric descending.
 *
 * Kind is treated as an analysis axis, so its default ordering matches the
 * other breakdowns.
 */
export function byKind(events: UsageEvent[], metric: Metric = "cost"): BucketStat[] {
  return sortByMetric(
    bucketBy(events, (e) => e.kind),
    metric,
  );
}

/**
 * Groups events by Hour in the selected Analysis Time Zone.
 *
 * Only hours that contain activity are returned. Period charts should fill
 * missing hours as zero (ADR-010), the same way Daily Window period charts
 * fill idle days.
 */
export function byHour(events: UsageEvent[], ctx: Partial<AnalysisContext> = {}): BucketStat[] {
  return bucketBy(events, (e) => hourOf(e.date, ctx)).sort((a, b) => a.key.localeCompare(b.key));
}

function byDailyWindowAndKey(
  events: UsageEvent[],
  keyOf: (e: UsageEvent) => string,
  ctx: Partial<AnalysisContext> = {},
): DailyWindowCostStat[] {
  const dailyWindows = new Map<string, DailyWindowCostStat>();
  for (const e of events) {
    const dailyWindow = dailyWindowKeyOf(e.date, ctx);
    let d = dailyWindows.get(dailyWindow);
    if (!d) {
      d = { dailyWindow, costByKey: {}, tokensByKey: {}, totalCost: 0, totalTokens: 0 };
      dailyWindows.set(dailyWindow, d);
    }
    const key = keyOf(e);
    d.costByKey[key] = (d.costByKey[key] ?? 0) + e.cost;
    d.tokensByKey[key] = (d.tokensByKey[key] ?? 0) + e.totalTokens;
    d.totalCost += e.cost;
    d.totalTokens += e.totalTokens;
  }
  return [...dailyWindows.values()].sort((a, b) => a.dailyWindow.localeCompare(b.dailyWindow));
}

/**
 * Builds Daily-Window-by-Model-Family cost buckets for stacked charts.
 *
 * `costByKey` is keyed by Model Family so stacked Daily Window charts stay readable.
 */
export function byDailyWindowAndModelFamily(
  events: UsageEvent[],
  ctx: Partial<AnalysisContext> = {},
): DailyWindowCostStat[] {
  return byDailyWindowAndKey(events, (e) => modelFamilyOf(e.model), ctx);
}

function emptyBucket(key: string): BucketStat {
  return {
    key,
    cost: 0,
    totalTokens: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheRead: 0,
    eventCount: 0,
  };
}

function emptyDailyWindowCost(dailyWindow: string): DailyWindowCostStat {
  return {
    dailyWindow,
    costByKey: {},
    tokensByKey: {},
    totalCost: 0,
    totalTokens: 0,
  };
}

/**
 * Fills missing Daily Window Keys in a chronological bucket series with zeros.
 *
 * The span is the Daily Window Range. Summaries, rankings, and Active Daily
 * Window counts must keep using the sparse series from `byDailyWindow`.
 */
export function includeEmptyDailyWindows(buckets: BucketStat[]): BucketStat[] {
  if (buckets.length === 0) return [];
  const byKey = new Map(buckets.map((b) => [b.key, b]));
  const first = buckets[0]!.key;
  const last = buckets[buckets.length - 1]!.key;
  return dailyWindowKeysInRange(first, last).map((key) => byKey.get(key) ?? emptyBucket(key));
}

/**
 * Fills missing Daily Window Keys in a stacked Daily Window series with zeros.
 */
export function includeEmptyDailyWindowCosts(rows: DailyWindowCostStat[]): DailyWindowCostStat[] {
  if (rows.length === 0) return [];
  const byKey = new Map(rows.map((row) => [row.dailyWindow, row]));
  const first = rows[0]!.dailyWindow;
  const last = rows[rows.length - 1]!.dailyWindow;
  return dailyWindowKeysInRange(first, last).map(
    (key) => byKey.get(key) ?? emptyDailyWindowCost(key),
  );
}

/**
 * Returns the Daily Window total for the Selected Metric.
 */
export function dailyWindowMetricTotal(row: DailyWindowCostStat, metric: Metric): number {
  return metric === "tokens" ? row.totalTokens : row.totalCost;
}

/**
 * Returns the per-key stacked values for the Selected Metric.
 */
export function dailyWindowMetricByKey(
  row: DailyWindowCostStat,
  metric: Metric,
): Record<string, number> {
  return metric === "tokens" ? row.tokensByKey : row.costByKey;
}

/**
 * Returns the highest-Metric Usage Events.
 *
 * This is a relative ranking over the caller's current analysis set,
 * not a fixed threshold.
 */
export function topEvents(
  events: UsageEvent[],
  limit: number,
  metric: Metric = "cost",
): UsageEvent[] {
  return [...events]
    .sort((a, b) => eventMetric(b, metric) - eventMetric(a, metric))
    .slice(0, limit);
}
