import type { BucketStat } from "../../src/core/types.ts";

import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  DefaultTooltipContent,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatTokens, formatUsd, formatUsdPerMTok } from "../../src/core/format.ts";
import { tooltipItemStyle, tooltipStyle } from "./shared.ts";

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
  const data = rows.map((row) => ({
    ...row,
    value:
      metric === "cost"
        ? row.cost
        : metric === "tokens"
          ? row.totalTokens
          : metric === "cloud"
            ? (row.cloudAgentUsageRate ?? 0)
            : (row.cost / row.totalTokens) * 1_000_000,
  }));
  const selectable = showControls && !!onSelectUser;
  const format = (value: number) =>
    metric === "tokens"
      ? formatTokens(value)
      : metric === "cloud"
        ? `${value.toFixed(1)}%`
        : metric === "rate"
          ? `${formatUsd(value)} / MTok`
          : formatUsd(value, { trimZeroCents: true });
  return (
    <div className="user-ranking-chart">
      <ResponsiveContainer width="100%" height={340}>
        <ComposedChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 12, bottom: 0, left: 0 }}
        >
          <CartesianGrid stroke="#21262d" horizontal={false} />
          <XAxis
            type="number"
            domain={metric === "cloud" ? [0, 100] : [0, "auto"]}
            stroke="#8b949e"
            fontSize={11}
            tickFormatter={format}
          />
          <YAxis
            type="category"
            dataKey="key"
            interval={0}
            width={190}
            stroke="#8b949e"
            tick={({ x, y, payload }) => (
              <g transform={`translate(${x},${y})`}>
                <foreignObject x={-185} y={-12} width={177} height={24}>
                  {selectable ? (
                    <button
                      className="ranking-user-label"
                      type="button"
                      title={String(payload.value)}
                      aria-pressed={selectedUser === payload.value}
                      onClick={() => onSelectUser?.(String(payload.value))}
                    >
                      {String(payload.value)}
                    </button>
                  ) : (
                    <span className="ranking-user-label" title={String(payload.value)}>
                      {String(payload.value)}
                    </span>
                  )}
                </foreignObject>
              </g>
            )}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            itemStyle={tooltipItemStyle}
            labelStyle={tooltipItemStyle}
            content={(props) => {
              const item = props.payload?.[0];
              if (!props.active || !item) return null;
              const row = item.payload as Row;
              const fields =
                metric === "cloud"
                  ? [
                      ["Cloud Agent使用率", `${(row.cloudAgentUsageRate ?? 0).toFixed(1)}%`],
                      [
                        "Cloud Agentイベント",
                        `${row.cloudAgentEventCount ?? 0} / ${row.eventCount}`,
                      ],
                    ]
                  : [
                      ["コスト", formatUsd(row.cost)],
                      ["トークン", formatTokens(row.totalTokens)],
                      ["実行単価", formatUsdPerMTok(row.cost, row.totalTokens)],
                    ];
              return (
                <DefaultTooltipContent
                  {...props}
                  label={row.key}
                  payload={fields.map(([name, value], index) => ({
                    ...item,
                    name,
                    value,
                    dataKey: String(index),
                  }))}
                  itemSorter={undefined}
                  formatter={(value) => String(value)}
                />
              );
            }}
          />
          <Bar
            dataKey="value"
            radius={[0, 4, 4, 0]}
            barSize={22}
            isAnimationActive={false}
            cursor={selectable ? "pointer" : undefined}
            onClick={(row) => {
              if (selectable && typeof row.key === "string") onSelectUser?.(row.key);
            }}
          >
            {data.map((row) => (
              <Cell
                key={row.key}
                fill="#58a6ff"
                opacity={!selectedUser || selectedUser === row.key ? 1 : 0.25}
              />
            ))}
          </Bar>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
