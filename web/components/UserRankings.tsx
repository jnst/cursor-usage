import type { UsageEvent } from "../../src/core/types.ts";

import { useMemo, useState } from "react";

import {
  byUser,
  topUsersByEffectiveRate,
  topUsersByCloudAgentUsage,
  type RankingOrder,
} from "../../src/core/aggregate.ts";
import { useLanguage } from "../i18n/LanguageProvider.tsx";
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
  const { t } = useLanguage();
  const [orders, setOrders] = useState<Record<UserRankingMetric, RankingOrder>>({
    cost: "desc",
    tokens: "desc",
    rate: "asc",
    cloud: "desc",
  });
  const rankings = useMemo(
    () => [
      {
        title: t("Top 10 by Spend"),
        rows: byUser(events, "cost", orders.cost).slice(0, 10),
        metric: "cost" as const,
      },
      {
        title: t("Top 10 by Tokens"),
        rows: byUser(events, "tokens", orders.tokens).slice(0, 10),
        metric: "tokens" as const,
      },
      {
        title: t("Top 10 by Effective Rate"),
        rows: topUsersByEffectiveRate(events, 10, orders.rate),
        metric: "rate" as const,
      },
      {
        title: t("Top 10 by Cloud Agent Usage Rate"),
        rows: topUsersByCloudAgentUsage(events, 10, orders.cloud),
        metric: "cloud" as const,
      },
    ],
    [events, orders, t],
  );
  return (
    <div className="user-rankings wide">
      {rankings.map(({ title, rows, metric }) => (
        <section className="panel" key={metric}>
          <div className="ranking-header">
            <h3>{title}</h3>
            {showControls && (
              <div
                className="model-metric-toggle"
                role="group"
                aria-label={t("rankingOrder", { title })}
              >
                {(["desc", "asc"] as const).map((order) => (
                  <button
                    type="button"
                    key={order}
                    aria-pressed={orders[metric] === order}
                    onClick={() => setOrders((current) => ({ ...current, [metric]: order }))}
                  >
                    {t(order === "desc" ? "Highest first" : "Lowest first")}
                  </button>
                ))}
              </div>
            )}
          </div>
          <p className="ranking-note">
            {metric === "cloud"
              ? t("Billable Events with a Cloud Agent ID ÷ all Billable Events.")
              : metric === "rate"
                ? t("Total Spend ÷ Total Tokens × 1 million. Varies with Model and cache usage.")
                : showControls
                  ? t(
                      "Compare all Users in the same period. Select a User name to filter or clear the filter.",
                    )
                  : t("Compare all Users in the same period.")}
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
          {rows.length === 0 && <p className="meta">{t("No eligible Users.")}</p>}
        </section>
      ))}
    </div>
  );
}
