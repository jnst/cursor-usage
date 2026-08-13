import type { UsageEvent } from "../../src/core/types.ts";

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
import { formatUsd } from "../../src/core/format.ts";
import { BAR_SIZE, tooltipStyle } from "./shared.ts";

/**
 * Top-10 User cost bars with optional click-to-filter.
 *
 * Unselected users stay visible at reduced opacity so a User filter can be
 * compared against the rest of the analysis set.
 */
export function UserChart({
  events,
  selectedUser,
  showControls,
  onSelectUser,
  height = 280,
  barFill = "#58a6ff",
}: {
  events: UsageEvent[];
  selectedUser: string | null;
  showControls: boolean;
  onSelectUser?: (user: string) => void;
  height?: number;
  barFill?: string;
}) {
  const data = useMemo(() => byUser(events).slice(0, 10), [events]);
  const isSelected = (user: string) => !selectedUser || selectedUser === user;
  const selectable = showControls && onSelectUser;
  return (
    <div className="panel">
      <h3>
        ユーザー別コスト (Top 10)
        {selectable && <span className="hint">バーをクリックでユーザー選択/解除</span>}
      </h3>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} layout="vertical">
          <CartesianGrid stroke="#21262d" horizontal={false} />
          <XAxis
            type="number"
            stroke="#8b949e"
            fontSize={12}
            tickFormatter={(value) => formatUsd(Number(value), { trimZeroCents: true })}
          />
          <YAxis type="category" dataKey="key" stroke="#8b949e" fontSize={12} width={160} />
          <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatUsd(Number(value))} />
          <Bar
            dataKey="cost"
            name="Cost"
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
