import type { AnalysisContext, UsageEvent } from "../../src/core/types.ts";

import { useMemo, useState, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { analyzeCloudAgents } from "../../src/core/cloud-agent.ts";
import { formatDateTime, formatTokens, formatUsd } from "../../src/core/format.ts";
import { useLanguage } from "../i18n/LanguageProvider.tsx";
import { useCostVisibility } from "./CostVisibility.tsx";
import { topRankingRows } from "./ranking.ts";
import { SummaryCards } from "./SummaryCards.tsx";

function Ranking({
  title,
  rows,
  format,
  color,
  hideAxis = false,
}: {
  title: string;
  rows: { key: string; label: string; value: number; detail?: ReactNode }[];
  format: (value: number) => string;
  color: string;
  hideAxis?: boolean;
}) {
  const { t } = useLanguage();
  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  return (
    <section
      className="cloud-agent-chart"
      onMouseMove={(event) => setPointer({ x: event.clientX, y: event.clientY })}
    >
      <h3>{title}</h3>
      <div className="table-wrap">
        <div style={{ minWidth: 470 }}>
          <ResponsiveContainer width="100%" height={Math.max(180, rows.length * 30 + 40)}>
            <BarChart data={rows} layout="vertical" margin={{ right: 16 }}>
              <CartesianGrid stroke="#21262d" horizontal={false} />
              <XAxis
                type="number"
                stroke="#8b949e"
                fontSize={12}
                tickFormatter={hideAxis ? () => "" : format}
              />
              <YAxis
                type="category"
                dataKey="label"
                width={185}
                interval={0}
                stroke="#8b949e"
                fontSize={11}
                tickFormatter={(key: string) =>
                  key.length > 22 ? `${key.slice(0, 11)}…${key.slice(-8)}` : key
                }
              />
              <Tooltip
                cursor={{ fill: "#8b949e", fillOpacity: 0.12 }}
                portal={document.body}
                wrapperStyle={{
                  zIndex: 100,
                  pointerEvents: "none",
                  position: "fixed",
                  left: Math.max(12, Math.min(pointer.x + 16, window.innerWidth - 372)),
                  top: Math.max(12, Math.min(pointer.y + 12, window.innerHeight - 480)),
                }}
                content={({ active, payload }) =>
                  active && payload?.length ? (
                    <div className="chart-tooltip cloud-agent-tooltip">
                      {payload[0]?.payload.detail ?? (
                        <>
                          <div className="chart-tooltip-label">{payload[0]?.payload.label}</div>
                          <dl>
                            <div>
                              <dt>{t("Cloud Agent ID Count")}</dt>
                              <dd>{format(Number(payload[0]?.value))}</dd>
                            </div>
                          </dl>
                        </>
                      )}
                    </div>
                  ) : null
                }
              />
              <Bar dataKey="value" fill={color} barSize={18} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}

type Agent = ReturnType<typeof analyzeCloudAgents>["agents"][number];

/** Tooltip content is rendered only for the hovered ID. */
function AgentTooltip({ a, ctx }: { a: Agent; ctx: AnalysisContext }) {
  const { t, language } = useLanguage();
  const { formatCost } = useCostVisibility();
  return (
    <>
      <div className="cloud-agent-tooltip-heading">Cloud Agent</div>
      <dl>
        <div>
          <dt>{t("User")}</dt>
          <dd>
            {a.users.map((user) => (
              <span className="cloud-agent-tooltip-user" key={user}>
                {user}
              </span>
            ))}
          </dd>
        </div>
        <div>
          <dt>{t("Spend")}</dt>
          <dd>{formatCost(a.cost)}</dd>
        </div>
        <div>
          <dt>{t("Tokens")}</dt>
          <dd>{formatTokens(a.totalTokens)}</dd>
        </div>
        <div>
          <dt>{t("Event Count")}</dt>
          <dd>{a.eventCount.toLocaleString(language)}</dd>
        </div>
        <div>
          <dt>{t("First observed")}</dt>
          <dd>{formatDateTime(new Date(a.firstObserved), ctx.timeZone)}</dd>
        </div>
        <div>
          <dt>{t("Last observed")}</dt>
          <dd>{formatDateTime(new Date(a.lastObserved), ctx.timeZone)}</dd>
        </div>
        <div>
          <dt>{t("Analysis Time Zone")}</dt>
          <dd>{ctx.timeZone}</dd>
        </div>
      </dl>
      <div className="cloud-agent-tooltip-section">{t("Events by Model")}</div>
      <dl>
        {a.models.slice(0, 4).map((model) => (
          <div key={model.key}>
            <dt>{model.key}</dt>
            <dd>{model.eventCount.toLocaleString(language)}</dd>
          </div>
        ))}
      </dl>
      {a.models.length > 4 && (
        <div className="cloud-agent-tooltip-more">
          {t("moreModels", { count: a.models.length - 4 })}
        </div>
      )}
      <div className="cloud-agent-tooltip-section">Cloud Agent ID</div>
      <div className="cloud-agent-tooltip-id">{a.key}</div>
    </>
  );
}

export function CloudAgentAnalysis({
  events,
  ctx,
}: {
  events: UsageEvent[];
  ctx: AnalysisContext;
}) {
  const { t, language } = useLanguage();
  const { agents, summary: s, byUser } = useMemo(() => analyzeCloudAgents(events), [events]);
  const { formatCost, hidden } = useCostVisibility();
  // Rank raw data before constructing display rows, and retain it across language changes.
  const ranked = useMemo(
    () => ({
      cost: topRankingRows(agents, (a) => a.cost),
      tokens: topRankingRows(agents, (a) => a.totalTokens),
      events: topRankingRows(agents, (a) => a.eventCount),
      users: topRankingRows(byUser, (a) => a.agentCount),
    }),
    [agents, byUser],
  );
  const agentRow = (a: (typeof agents)[number], value: number) => ({
    key: a.key,
    label: formatDateTime(new Date(a.firstObserved), ctx.timeZone),
    value,
    detail: <AgentTooltip a={a} ctx={ctx} />,
  });
  return (
    <details className="panel wide analysis-disclosure" open>
      <summary>{t("Analysis by Cloud Agent ID")}</summary>
      <p className="meta">
        {t(
          "Billable Events are grouped by ID within the current period and filters. Observed timestamps do not represent runtime or task completion.",
        )}
      </p>
      {agents.length === 0 ? (
        <p className="meta">{t("There are no Billable Events with a Cloud Agent ID.")}</p>
      ) : (
        <>
          <SummaryCards
            cards={[
              {
                label: t("Cloud Agent ID Count"),
                value: String(s.agentCount),
                sub: t("eventsTokens", {
                  count: s.eventCount,
                  tokens: formatTokens(s.totalTokens),
                }),
              },
              {
                label: t("Cloud Agent Total Spend"),
                value: formatCost(s.totalCost),
                sub: t("Only events with an ID"),
              },
              {
                label: t("Average Spend per ID"),
                value: formatUsd(s.meanCost),
                sub: t("median", { value: formatUsd(s.medianCost) }),
              },
              {
                label: t("Maximum Spend per ID"),
                value: formatCost(s.maxCost),
                sub: t("cloudShare", { share: s.top10CostShare.toFixed(1) }),
              },
            ]}
          />
          <p className="meta">{t("cloudChartHint", { zone: ctx.timeZone })}</p>
          <div className="user-rankings">
            <Ranking
              title={t("Top 10 Cloud Agent IDs by Spend")}
              hideAxis={hidden}
              rows={ranked.cost.map((a) => agentRow(a, a.cost))}
              format={formatCost}
              color="#58a6ff"
            />
            <Ranking
              title={t("Top 10 Cloud Agent IDs by Tokens")}
              rows={ranked.tokens.map((a) => agentRow(a, a.totalTokens))}
              format={formatTokens}
              color="#3fb950"
            />
            <Ranking
              title={t("Top 10 Cloud Agent IDs by Event Count")}
              rows={ranked.events.map((a) => agentRow(a, a.eventCount))}
              format={(v) => v.toLocaleString(language)}
              color="#d2a8ff"
            />
            <Ranking
              title={t("Top 10 Users by Cloud Agent ID Count")}
              rows={ranked.users.map((a) => ({ key: a.key, label: a.key, value: a.agentCount }))}
              format={(v) => v.toLocaleString(language)}
              color="#f0883e"
            />
          </div>
          <p className="meta">
            {t("An ID shared by multiple Users is counted once for each User.")}
          </p>
          <h3>{t("Cloud Agent summary (top 20 by Spend)")}</h3>
          <p className="meta">
            {t("cloudRows", { count: Math.min(20, agents.length), total: agents.length })}
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t("firstObserved", { zone: ctx.timeZone })}</th>
                  <th>{t("User")}</th>
                  <th>{t("Event Count")}</th>
                  <th>{t("Spend")}</th>
                  <th>{t("Tokens")}</th>
                  <th>{t("Events by Model")}</th>
                  <th>Cloud Agent ID</th>
                  <th>{t("lastObserved", { zone: ctx.timeZone })}</th>
                </tr>
              </thead>
              <tbody>
                {agents.slice(0, 20).map((agent) => (
                  <tr key={agent.key}>
                    <td>{formatDateTime(new Date(agent.firstObserved), ctx.timeZone)}</td>
                    <td>{agent.users.join(", ")}</td>
                    <td>{agent.eventCount}</td>
                    <td>{formatCost(agent.cost)}</td>
                    <td>{formatTokens(agent.totalTokens)}</td>
                    <td>
                      {agent.models.map((model) => `${model.key}: ${model.eventCount}`).join(", ")}
                    </td>
                    <td>{agent.key}</td>
                    <td>{formatDateTime(new Date(agent.lastObserved), ctx.timeZone)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </details>
  );
}
