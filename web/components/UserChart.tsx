import type { DisplayMetric, UsageEvent } from "../../src/core/types.ts";

import { useMemo } from "react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { byUser } from "../../src/core/aggregate.ts";
import { formatMetric, formatUsdPerMTok } from "../../src/core/format.ts";
import { BAR_SIZE, tooltipStyle } from "./shared.ts";

/**
 * Top-10 User bars with optional click-to-filter.
 *
 * Bars follow the selected Display Metric. Unselected users stay visible at
 * reduced opacity so a User filter can be compared against the rest of the
 * analysis set.
 */
export function UserChart({
  events,
  selectedUser,
  metric,
  showControls,
  onSelectUser,
  height = 280,
  barFill = "#58a6ff",
}: {
  events: UsageEvent[];
  selectedUser: string | null;
  metric: DisplayMetric;
  showControls: boolean;
  onSelectUser?: (user: string) => void;
  height?: number;
  barFill?: string;
}) {
  const data = useMemo(() => byUser(events, metric).slice(0, 10), [events, metric]);
  const isSelected = (user: string) => !selectedUser || selectedUser === user;
  const selectable = showControls && onSelectUser;
  const dataKey = metric === "tokens" ? "totalTokens" : "cost";
  return (
    <div className="panel">
      <h3>
        {metric === "cost" ? "ユーザー別コスト" : "ユーザー別トークン"} (Top 10)
        {selectable && <span className="hint">バーをクリックでユーザー選択/解除</span>}
      </h3>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} layout="vertical">
          <CartesianGrid stroke="#21262d" horizontal={false} />
          <XAxis
            type="number"
            stroke="#8b949e"
            fontSize={12}
            tickFormatter={(value) => formatMetric(Number(value), metric, { trimZeroCents: true })}
          />
          <YAxis type="category" dataKey="key" stroke="#8b949e" fontSize={12} width={160} />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value, _name, item) => {
              const row = item?.payload as { cost?: number; totalTokens?: number } | undefined;
              const cost = row?.cost ?? 0;
              const tokens = row?.totalTokens ?? 0;
              return [
                `${formatMetric(Number(value), metric)} · ${formatUsdPerMTok(cost, tokens)}`,
                metric === "cost" ? "Cost" : "Tokens",
              ];
            }}
          />
          <Bar
            dataKey={dataKey}
            name={metric === "cost" ? "Cost" : "Tokens"}
            radius={[0, 4, 4, 0]}
            cursor={selectable ? "pointer" : undefined}
            onClick={(payload) => {
              if (!selectable) return;
              const user = (payload as { key?: string } | undefined)?.key;
              if (user) onSelectUser(user);
            }}
            isAnimationActive={false}
            barSize={BAR_SIZE}
            maxBarSize={BAR_SIZE}
          >
            {data.map((entry) => (
              <Cell key={entry.key} fill={barFill} opacity={isSelected(entry.key) ? 1 : 0.25} />
            ))}
          </Bar>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
