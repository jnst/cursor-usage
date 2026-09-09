import type { UsageEvent } from "../../src/core/types.ts";

import { useMemo, useState } from "react";

import {
  byUser,
  topUsersByEffectiveRate,
  topUsersByCloudAgentUsage,
  type RankingOrder,
} from "../../src/core/aggregate.ts";
import { UserRankingChart, type UserRankingMetric } from "./UserRankingChart.tsx";

/** All rankings use the same comparison set, even when a User is selected. */
export function UserRankings({
  events,
  selectedUser,
  showControls,
  onSelectUser,
}: {
  events: UsageEvent[];
  selectedUser: string | null;
  showControls: boolean;
  onSelectUser?: (user: string) => void;
}) {
  const [orders, setOrders] = useState<Record<UserRankingMetric, RankingOrder>>({
    cost: "desc",
    tokens: "desc",
    rate: "asc",
    cloud: "desc",
  });
  const rankings = useMemo(
    () => [
      {
        title: "Spend Top 10",
        rows: byUser(events, "cost", orders.cost).slice(0, 10),
        metric: "cost" as const,
      },
      {
        title: "Tokens Top 10",
        rows: byUser(events, "tokens", orders.tokens).slice(0, 10),
        metric: "tokens" as const,
      },
      {
        title: "実行単価 Top 10",
        rows: topUsersByEffectiveRate(events, 10, orders.rate),
        metric: "rate" as const,
      },
      {
        title: "Cloud Agent使用率 Top 10",
        rows: topUsersByCloudAgentUsage(events, 10, orders.cloud),
        metric: "cloud" as const,
      },
    ],
    [events, orders],
  );
  return (
    <div className="user-rankings wide">
      {rankings.map(({ title, rows, metric }) => (
        <section className="panel" key={metric}>
          <div className="ranking-header">
            <h3>{title}</h3>
            {showControls && (
              <div className="model-metric-toggle" role="group" aria-label={`${title}の並び順`}>
                {(["desc", "asc"] as const).map((order) => (
                  <button
                    type="button"
                    key={order}
                    aria-pressed={orders[metric] === order}
                    onClick={() => setOrders((current) => ({ ...current, [metric]: order }))}
                  >
                    {order === "desc" ? "高い順" : "低い順"}
                  </button>
                ))}
              </div>
            )}
          </div>
          <p className="ranking-note">
            {metric === "cloud"
              ? "Cloud Agent IDありの課金イベント数 ÷ 全課金イベント数。"
              : metric === "rate"
                ? "合計 Spend ÷ 合計 Tokens × 100万。モデル・キャッシュ利用で変わります。"
                : showControls
                  ? "同じ期間の全ユーザーを比較。ユーザー名で選択／解除。"
                  : "同じ期間の全ユーザーを比較。"}
          </p>
          {rows.length > 0 && (
            <UserRankingChart
              rows={rows}
              metric={metric}
              selectedUser={selectedUser}
              showControls={showControls}
              onSelectUser={onSelectUser}
            />
          )}
          {rows.length === 0 && <p className="meta">対象ユーザーはいません。</p>}
        </section>
      ))}
    </div>
  );
}
