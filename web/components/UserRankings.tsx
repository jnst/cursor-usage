import type { UsageEvent } from "../../src/core/types.ts";

import { useMemo, useState } from "react";

import { byUser, topUsersByEffectiveRate, type RankingOrder } from "../../src/core/aggregate.ts";
import { formatTokens, formatUsd, formatUsdPerMTok } from "../../src/core/format.ts";

/** All three rankings use the same comparison set, even when a User is selected. */
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
  const [orders, setOrders] = useState<Record<"cost" | "tokens" | "rate", RankingOrder>>({
    cost: "desc",
    tokens: "desc",
    rate: "asc",
  });
  const rankings = useMemo(
    () => [
      {
        title: "コスト Top 10",
        rows: byUser(events, "cost", orders.cost).slice(0, 10),
        metric: "cost" as const,
      },
      {
        title: "トークン使用量 Top 10",
        rows: byUser(events, "tokens", orders.tokens).slice(0, 10),
        metric: "tokens" as const,
      },
      {
        title: "実行単価 Top 10",
        rows: topUsersByEffectiveRate(events, 10, orders.rate),
        metric: "rate" as const,
      },
    ],
    [events, orders],
  );
  return (
    <>
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
            {metric === "rate"
              ? "合計コスト ÷ 合計トークン × 100万。モデル・キャッシュ利用で変わります。"
              : showControls
                ? "同じ期間の全ユーザーを比較。ユーザー名で選択／解除。"
                : "同じ期間の全ユーザーを比較。"}
          </p>
          <ol className="ranking-list">
            {rows.map((row) => (
              <li
                key={row.key}
                style={{ opacity: !selectedUser || selectedUser === row.key ? 1 : 0.4 }}
              >
                <div className="ranking-heading">
                  {showControls && onSelectUser ? (
                    <button
                      type="button"
                      aria-pressed={selectedUser === row.key}
                      onClick={() => onSelectUser(row.key)}
                    >
                      {row.key}
                    </button>
                  ) : (
                    <span>{row.key}</span>
                  )}
                  <strong>
                    {metric === "rate"
                      ? formatUsdPerMTok(row.cost, row.totalTokens)
                      : metric === "tokens"
                        ? formatTokens(row.totalTokens)
                        : formatUsd(row.cost)}
                  </strong>
                </div>
                <div className="ranking-meta">
                  {formatUsd(row.cost)} · {formatTokens(row.totalTokens)} tokens
                </div>
              </li>
            ))}
          </ol>
          {rows.length === 0 && <p className="meta">対象ユーザーはいません。</p>}
        </section>
      ))}
    </>
  );
}
