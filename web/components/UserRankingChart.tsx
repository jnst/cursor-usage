import type { BucketStat } from "../../src/core/types.ts";

import { formatTokens, formatUsdPerMTok } from "../../src/core/format.ts";
import { useCostVisibility } from "./CostVisibility.tsx";

export type UserRankingMetric = "cost" | "tokens" | "rate" | "cloud";
type Row = BucketStat & { cloudAgentUsageRate?: number; cloudAgentEventCount?: number };

export function UserRankingChart({
  rows,
  metric,
  selectedUser,
  showControls,
  onSelectUser,
}: {
  rows: Row[];
  metric: UserRankingMetric;
  selectedUser: string | null;
  showControls: boolean;
  onSelectUser?: (user: string) => void;
}) {
  const { formatCost } = useCostVisibility();
  const valueOf = (row: Row) =>
    metric === "cost"
      ? row.cost
      : metric === "tokens"
        ? row.totalTokens
        : metric === "cloud"
          ? (row.cloudAgentUsageRate ?? 0)
          : row.totalTokens > 0
            ? (row.cost / row.totalTokens) * 1_000_000
            : 0;
  const max = metric === "cloud" ? 100 : Math.max(0, ...rows.map(valueOf));
  const selectable = showControls && !!onSelectUser;
  return (
    <ol className="user-ranking-list">
      {rows.map((row, index) => {
        const primary =
          metric === "cost"
            ? formatCost(row.cost)
            : metric === "tokens"
              ? formatTokens(row.totalTokens)
              : metric === "cloud"
                ? `${(row.cloudAgentUsageRate ?? 0).toFixed(1)}%`
                : formatUsdPerMTok(row.cost, row.totalTokens);
        return (
          <li
            key={row.key}
            className={selectedUser && selectedUser !== row.key ? "ranking-muted" : undefined}
          >
            <span
              className="ranking-background"
              aria-hidden="true"
              style={{ width: `${max > 0 ? Math.min(100, (valueOf(row) / max) * 100) : 0}%` }}
            />
            <span className="ranking-position" aria-hidden="true">
              {index + 1}.
            </span>
            <div className="ranking-content">
              <div className="ranking-main">
                {selectable ? (
                  <button
                    type="button"
                    className="ranking-user"
                    aria-pressed={selectedUser === row.key}
                    onClick={() => onSelectUser?.(row.key)}
                  >
                    {row.key}
                  </button>
                ) : (
                  <span className="ranking-user">{row.key}</span>
                )}
                <strong className="ranking-primary">{primary}</strong>
              </div>
              <div className="ranking-support">
                {metric !== "cloud" ? (
                  <>
                    {metric !== "cost" && <span>Spend {formatCost(row.cost)}</span>}
                    {metric !== "tokens" && <span>Tokens {formatTokens(row.totalTokens)}</span>}
                    {metric !== "rate" && (
                      <span>実行単価 {formatUsdPerMTok(row.cost, row.totalTokens)}</span>
                    )}
                  </>
                ) : (
                  <span>
                    Cloud Agentイベント {row.cloudAgentEventCount ?? 0} / {row.eventCount}
                  </span>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
