export interface UsageEvent {
  date: Date;
  user: string;
  cloudAgentId: string | null;
  automationId: string | null;
  kind: string;
  model: string;
  maxMode: boolean;
  inputWithCacheWrite: number;
  inputWithoutCacheWrite: number;
  cacheRead: number;
  outputTokens: number;
  totalTokens: number;
  /** USD */
  cost: number;
}

export const NO_CHARGE_KIND = "Errored, No Charge";

/** Primary analysis quantity: reported Cost or Token Count. */
export type Metric = "cost" | "tokens";

export const DEFAULT_METRIC: Metric = "cost";

/**
 * Returns true when a CLI option or URL value is a supported Metric.
 */
export function isMetric(value: string | null | undefined): value is Metric {
  return value === "cost" || value === "tokens";
}

/**
 * Time-axis settings used to group Usage Events into Daily Windows and Hours.
 *
 * These two fields travel together: a Daily Window Key is only meaningful in
 * an Analysis Time Zone at a chosen start hour. Selected Metric is passed
 * alongside this context; it does not change window boundaries.
 */
export interface AnalysisContext {
  timeZone: string;
  startHour: number;
}

export interface Summary {
  totalCost: number;
  totalTokens: number;
  eventCount: number;
  /** YYYY-MM-DD Daily Window Key in the selected analysis time zone */
  firstDailyWindow: string | null;
  lastDailyWindow: string | null;
  dailyWindowCount: number;
  avgCostPerActiveDailyWindow: number;
  maxModeRatio: number;
  userCount: number;
  modelCount: number;
}

export interface BucketStat {
  key: string;
  cost: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  cacheRead: number;
  eventCount: number;
}

/** Daily Window totals stacked by a grouping key (Model or Model Family). */
export interface DailyWindowCostStat {
  dailyWindow: string;
  /** grouping key (Model or Model Family) -> cost */
  costByKey: Record<string, number>;
  /** grouping key (Model or Model Family) -> token count */
  tokensByKey: Record<string, number>;
  totalCost: number;
  totalTokens: number;
}
