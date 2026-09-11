import type { UsageEvent } from "../../src/core/types.ts";

import { useMemo, useState } from "react";

import {
  byUser,
  topUsersByCount,
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
    models: "desc",
    largeEvents: "desc",
    events: "desc",
  });
  const rankings = useMemo(
    () => [
      {
        title: "Top 10 by Spend" as const,
        rows: byUser(events, "cost", orders.cost).slice(0, 10),
        metric: "cost" as const,
      },
      {
        title: "Top 10 by Tokens" as const,
        rows: byUser(events, "tokens", orders.tokens).slice(0, 10),
        metric: "tokens" as const,
      },
      {
        title: "Top 10 by Event Count" as const,
        rows: topUsersByCount(events, "events", 10, orders.events),
        metric: "events" as const,
      },
      {
        title: "Top 10 by Events with 5M+ Tokens" as const,
        rows: topUsersByCount(events, "largeEvents", 10, orders.largeEvents),
        metric: "largeEvents" as const,
      },
      {
        title: "Top 10 by Effective Rate" as const,
        rows: topUsersByEffectiveRate(events, 10, orders.rate),
        metric: "rate" as const,
      },
      {
        title: "Top 10 by Model Count" as const,
        rows: topUsersByCount(events, "models", 10, orders.models),
        metric: "models" as const,
      },
      {
        title: "Top 10 by Cloud Agent Usage Rate" as const,
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
            <h3>{t(title)}</h3>
            {showControls && (
              <div
                className="model-metric-toggle"
                role="group"
                aria-label={t("rankingOrder", { title: t(title) })}
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
            {metric === "models"
              ? t("Distinct Model identifiers, including all variants.")
              : metric === "largeEvents"
                ? t("Billable Events with at least 5 million Tokens each.")
                : metric === "cloud"
                  ? t("Billable Events with a Cloud Agent ID ÷ all Billable Events.")
                  : metric === "rate"
                    ? t(
                        "Total Spend ÷ Total Tokens × 1 million. Varies with Model and cache usage.",
                      )
                    : metric === "cost"
                      ? t("Total Spend on Billable Events per User in the selected period.")
                      : metric === "tokens"
                        ? t("Total Tokens consumed by each User in the selected period.")
                        : t("Number of Billable Events per User in the selected period.")}
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
