import type { AnalysisContext, UsageEvent } from "../../src/core/types.ts";

import { useMemo } from "react";
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
}: {
  title: string;
  rows: { key: string; value: number }[];
  format: (value: number) => string;
  color: string;
}) {
  const top = [...rows]
    .sort((a, b) => b.value - a.value || a.key.localeCompare(b.key))
    .slice(0, 10);
  return (
    <section className="cloud-agent-chart">
      <h3>{title}</h3>
      <div className="table-wrap">
        <div style={{ minWidth: 470 }}>
          <ResponsiveContainer width="100%" height={Math.max(180, top.length * 30 + 40)}>
            <BarChart data={top} layout="vertical" margin={{ right: 16 }}>
              <CartesianGrid stroke="#21262d" horizontal={false} />
              <XAxis type="number" stroke="#8b949e" fontSize={12} tickFormatter={format} />
              <YAxis
                type="category"
                dataKey="key"
                width={160}
                interval={0}
                stroke="#8b949e"
                fontSize={11}
                tickFormatter={(key: string) =>
                  key.length > 22 ? `${key.slice(0, 11)}…${key.slice(-8)}` : key
                }
              />
              <Tooltip
                content={({ active, payload }) =>
                  active && payload?.length ? (
                    <div className="chart-tooltip">
                      <div className="chart-tooltip-label">{payload[0]?.payload.key}</div>
                      {format(Number(payload[0]?.value))}
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
  const { formatCost } = useCostVisibility();
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
                sub: `${s.eventCount} events · ${formatTokens(s.totalTokens)} tokens`,
              },
              {
                label: "Cloud Agent 合計コスト",
                value: formatCost(s.totalCost),
                sub: "ID があるイベントのみ",
              },
              {
                label: "ID あたり平均コスト",
                value: formatUsd(s.meanCost),
                sub: `中央値 ${formatUsd(s.medianCost)}`,
              },
              {
                label: "ID あたり最大コスト",
                value: formatCost(s.maxCost),
                sub: `コスト上位 10 ID の占有率 ${s.top10CostShare.toFixed(1)}%`,
              },
            ]}
          />
          <div className="user-rankings">
            <Ranking
              title="Cloud Agent コスト Top 10"
              rows={agents.map((a) => ({ key: a.key, value: a.cost }))}
              format={formatCost}
              color="#58a6ff"
            />
            <Ranking
              title="Cloud Agent トークン Top 10"
              rows={agents.map((a) => ({ key: a.key, value: a.totalTokens }))}
              format={formatTokens}
              color="#3fb950"
            />
            <Ranking
              title="Cloud Agent イベント数 Top 10"
              rows={agents.map((a) => ({ key: a.key, value: a.eventCount }))}
              format={(v) => v.toLocaleString()}
              color="#d2a8ff"
            />
            <Ranking
              title="ユーザー別 Cloud Agent ID 数 Top 10"
              rows={byUser.map((a) => ({ key: a.key, value: a.agentCount }))}
              format={(v) => v.toLocaleString()}
              color="#f0883e"
            />
          </div>
          <p className="meta">
            同じ ID が複数ユーザーに現れる場合、各ユーザーで 1 件と数えます。以下はコスト降順です。
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Cloud Agent ID</th>
                  <th>ユーザー</th>
                  <th>イベント数</th>
                  <th>コスト</th>
                  <th>トークン</th>
                  <th>モデル別イベント数</th>
                  <th>最初の観測 ({ctx.timeZone})</th>
                  <th>最後の観測 ({ctx.timeZone})</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((agent) => (
                  <tr key={agent.key}>
                    <td>{agent.key}</td>
                    <td>{agent.users.join(", ")}</td>
                    <td>{agent.eventCount}</td>
                    <td>{formatCost(agent.cost)}</td>
                    <td>{formatTokens(agent.totalTokens)}</td>
                    <td>
                      {agent.models.map((model) => `${model.key}: ${model.eventCount}`).join(", ")}
                    </td>
                    <td>{formatDateTime(new Date(agent.firstObserved), ctx.timeZone)}</td>
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
