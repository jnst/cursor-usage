import type { AnalysisContext, UsageEvent } from "../../src/core/types.ts";

import { useMemo, useState, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { analyzeCloudAgents } from "../../src/core/cloud-agent.ts";
import { formatDateTime, formatTokens, formatUsd } from "../../src/core/format.ts";
import { useCostVisibility } from "./CostVisibility.tsx";
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
  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  const top = [...rows]
    .sort((a, b) => b.value - a.value || a.key.localeCompare(b.key))
    .slice(0, 10);
  return (
    <section
      className="cloud-agent-chart"
      onMouseMove={(event) => setPointer({ x: event.clientX, y: event.clientY })}
    >
      <h3>{title}</h3>
      <div className="table-wrap">
        <div style={{ minWidth: 470 }}>
          <ResponsiveContainer width="100%" height={Math.max(180, top.length * 30 + 40)}>
            <BarChart data={top} layout="vertical" margin={{ right: 16 }}>
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
                              <dt>Cloud Agent ID 数</dt>
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

export function CloudAgentAnalysis({
  events,
  ctx,
}: {
  events: UsageEvent[];
  ctx: AnalysisContext;
}) {
  const { agents, summary: s, byUser } = useMemo(() => analyzeCloudAgents(events), [events]);
  const { formatCost, hidden } = useCostVisibility();
  const agentRow = (a: (typeof agents)[number], value: number) => ({
    key: a.key,
    label: formatDateTime(new Date(a.firstObserved), ctx.timeZone),
    value,
    detail: (
      <>
        <div className="cloud-agent-tooltip-heading">Cloud Agent</div>
        <dl>
          <div>
            <dt>ユーザー</dt>
            <dd>
              {a.users.map((user) => (
                <span className="cloud-agent-tooltip-user" key={user}>
                  {user}
                </span>
              ))}
            </dd>
          </div>
          <div>
            <dt>支出</dt>
            <dd>{formatCost(a.cost)}</dd>
          </div>
          <div>
            <dt>トークン</dt>
            <dd>{formatTokens(a.totalTokens)}</dd>
          </div>
          <div>
            <dt>イベント数</dt>
            <dd>{a.eventCount.toLocaleString()}</dd>
          </div>
          <div>
            <dt>最初の観測</dt>
            <dd>{formatDateTime(new Date(a.firstObserved), ctx.timeZone)}</dd>
          </div>
          <div>
            <dt>最後の観測</dt>
            <dd>{formatDateTime(new Date(a.lastObserved), ctx.timeZone)}</dd>
          </div>
          <div>
            <dt>タイムゾーン</dt>
            <dd>{ctx.timeZone}</dd>
          </div>
        </dl>
        <div className="cloud-agent-tooltip-section">モデル別イベント数</div>
        <dl>
          {a.models.slice(0, 4).map((model) => (
            <div key={model.key}>
              <dt>{model.key}</dt>
              <dd>{model.eventCount.toLocaleString()}</dd>
            </div>
          ))}
        </dl>
        {a.models.length > 4 && (
          <div className="cloud-agent-tooltip-more">
            ほか {a.models.length - 4} モデル（集計一覧に表示）
          </div>
        )}
        <div className="cloud-agent-tooltip-section">Cloud Agent ID</div>
        <div className="cloud-agent-tooltip-id">{a.key}</div>
      </>
    ),
  });
  return (
    <details className="panel wide analysis-disclosure" open>
      <summary>Cloud Agent ID 別の分析</summary>
      <p className="meta">
        現在の期間・絞り込み内の課金イベントを ID
        ごとに集計。観測日時は稼働時間やタスクの完了を表しません。
      </p>
      {agents.length === 0 ? (
        <p className="meta">Cloud Agent ID を持つ課金イベントはありません。</p>
      ) : (
        <>
          <SummaryCards
            cards={[
              {
                label: "Cloud Agent ID 数",
                value: String(s.agentCount),
                sub: `${s.eventCount} events / ${formatTokens(s.totalTokens)} tokens`,
              },
              {
                label: "Cloud Agent 合計支出",
                value: formatCost(s.totalCost),
                sub: "ID があるイベントのみ",
              },
              {
                label: "ID あたり平均支出",
                value: formatUsd(s.meanCost),
                sub: `中央値 ${formatUsd(s.medianCost)}`,
              },
              {
                label: "ID あたり最大支出",
                value: formatCost(s.maxCost),
                sub: `支出上位 10 ID の占有率 ${s.top10CostShare.toFixed(1)}%`,
              },
            ]}
          />
          <p className="meta">
            グラフの日時は最初の観測 ({ctx.timeZone})。ホバーでユーザーと ID を確認できます。
          </p>
          <div className="user-rankings">
            <Ranking
              title="Cloud Agent 支出 Top 10"
              hideAxis={hidden}
              rows={agents.map((a) => agentRow(a, a.cost))}
              format={formatCost}
              color="#58a6ff"
            />
            <Ranking
              title="Cloud Agent トークン Top 10"
              rows={agents.map((a) => agentRow(a, a.totalTokens))}
              format={formatTokens}
              color="#3fb950"
            />
            <Ranking
              title="Cloud Agent イベント数 Top 10"
              rows={agents.map((a) => agentRow(a, a.eventCount))}
              format={(v) => v.toLocaleString()}
              color="#d2a8ff"
            />
            <Ranking
              title="ユーザー別 Cloud Agent ID 数 Top 10"
              rows={byUser.map((a) => ({ key: a.key, label: a.key, value: a.agentCount }))}
              format={(v) => v.toLocaleString()}
              color="#f0883e"
            />
          </div>
          <p className="meta">
            ユーザー別の ID 数は、同じ ID が複数ユーザーに現れる場合、各ユーザーで 1 件と数えます。
          </p>
          <h3>Cloud Agent 集計一覧（支出上位 20 件）</h3>
          <p className="meta">
            1 行は 1 つの ID の集計です。全 {agents.length} 件中 {Math.min(20, agents.length)}{" "}
            件を表示。
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>最初の観測 ({ctx.timeZone})</th>
                  <th>ユーザー</th>
                  <th>イベント数</th>
                  <th>支出</th>
                  <th>トークン</th>
                  <th>モデル別イベント数</th>
                  <th>Cloud Agent ID</th>
                  <th>最後の観測 ({ctx.timeZone})</th>
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
