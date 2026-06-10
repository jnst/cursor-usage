import {
  NO_CHARGE_KIND,
  type BucketStat,
  type DayModelStat,
  type Summary,
  type UsageEvent,
} from "./types.ts";

/** YYYY-MM-DD in UTC, matching the export timestamps. */
export function dayOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function billable(events: UsageEvent[]): UsageEvent[] {
  return events.filter((e) => e.kind !== NO_CHARGE_KIND);
}

export function summarize(events: UsageEvent[]): Summary {
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
    days.add(dayOf(e.date));
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
    avgCostPerDay: days.size > 0 ? totalCost / days.size : 0,
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

/** Sorted chronologically. */
export function byDay(events: UsageEvent[]): BucketStat[] {
  return bucketBy(events, (e) => dayOf(e.date)).sort((a, b) =>
    a.key.localeCompare(b.key),
  );
}

/** Sorted by cost descending. */
export function byUser(events: UsageEvent[]): BucketStat[] {
  return bucketBy(events, (e) => e.user).sort((a, b) => b.cost - a.cost);
}

/** Sorted by cost descending. */
export function byModel(events: UsageEvent[]): BucketStat[] {
  return bucketBy(events, (e) => e.model).sort((a, b) => b.cost - a.cost);
}

/** Sorted by event count descending. */
export function byKind(events: UsageEvent[]): BucketStat[] {
  return bucketBy(events, (e) => e.kind).sort(
    (a, b) => b.eventCount - a.eventCount,
  );
}

/** Cross-tab for stacked charts, sorted chronologically. */
export function byDayAndModel(events: UsageEvent[]): DayModelStat[] {
  const days = new Map<string, DayModelStat>();
  for (const e of events) {
    const day = dayOf(e.date);
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

/** Most expensive events first. */
export function topEvents(events: UsageEvent[], limit: number): UsageEvent[] {
  return [...events].sort((a, b) => b.cost - a.cost).slice(0, limit);
}
