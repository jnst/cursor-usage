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

export interface DailyWindowModelStat {
  dailyWindow: string;
  /** model name -> cost */
  costByModel: Record<string, number>;
  totalCost: number;
}
