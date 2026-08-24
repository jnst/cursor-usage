import type { Metric, UsageEvent } from "../../src/core/types.ts";

import { useMemo, useState } from "react";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { byModel, byModelFamily, eventsInModelFamily } from "../../src/core/aggregate.ts";
import { formatMetric } from "../../src/core/format.ts";
import { COLORS, metricLabel, tooltipItemStyle, tooltipStyle } from "./shared.ts";

/**
 * Model Family pie with a Model-level drilldown.
 *
 * The pie groups the Selected Metric by Model Family (Auto is one Router-level
 * slice). Clicking a slice swaps the pie for a table of the Models inside that
 * family — for Auto this reveals the actual Models the Router selected.
 */
export function ModelFamilyPanel({
  events,
  metric,
  familyColors,
  showControls,
  height = 280,
}: {
  events: UsageEvent[];
  metric: Metric;
  familyColors: Map<string, string>;
  showControls: boolean;
  height?: number;
}) {
  const [selectedFamily, setSelectedFamily] = useState<string | null>(null);
  const families = useMemo(
    () =>
      byModelFamily(events, metric).map((row) => ({
        ...row,
        value: metric === "tokens" ? row.totalTokens : row.cost,
      })),
    [events, metric],
  );
  const models = useMemo(
    () => (selectedFamily ? byModel(eventsInModelFamily(events, selectedFamily), metric) : []),
    [events, selectedFamily, metric],
  );
  const label = metricLabel(metric);

  if (selectedFamily) {
    const familyTotal = models.reduce(
      (sum, m) => sum + (metric === "tokens" ? m.totalTokens : m.cost),
      0,
    );
    const maxValue = Math.max(
      ...models.map((m) => (metric === "tokens" ? m.totalTokens : m.cost)),
      0,
    );
    return (
      <div className="panel">
        <h3>
          <button
            type="button"
            className="panel-back"
            onClick={() => setSelectedFamily(null)}
            aria-label="モデル分類へ戻る"
          >
            ←
          </button>
          {selectedFamily} の内訳
          <span className="hint">
            {formatMetric(familyTotal, metric)} ・ モデル別
            {selectedFamily === "Auto" ? " (Auto の実モデル)" : ""}
          </span>
        </h3>
        <div className="table-wrap scroll">
          <table>
            <thead>
              <tr>
                <th>モデル</th>
                <th className="num">イベント</th>
                <th className="num">{label}</th>
              </tr>
            </thead>
            <tbody>
              {models.length === 0 ? (
                <tr>
                  <td colSpan={3}>この分類のイベントはありません。</td>
                </tr>
              ) : (
                models.map((m) => {
                  const value = metric === "tokens" ? m.totalTokens : m.cost;
                  return (
                    <tr key={m.key}>
                      <td>
                        <span className="badge">{m.key}</span>
                      </td>
                      <td className="num">{m.eventCount}</td>
                      <td className="num">
                        <span
                          className="cost-bar"
                          style={{ width: maxValue > 0 ? `${(value / maxValue) * 96}px` : 0 }}
                        />
                        {formatMetric(value, metric)}
                        <span className="share">
                          {familyTotal > 0 ? ` ${Math.round((value / familyTotal) * 100)}%` : ""}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="panel">
      <h3>
        モデル分類別{metric === "tokens" ? "トークン" : "コスト"}
        {showControls && <span className="hint">クリックで実モデルの内訳へ</span>}
      </h3>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={families}
            dataKey="value"
            nameKey="key"
            innerRadius={height >= 280 ? 55 : 50}
            outerRadius={height >= 280 ? 95 : 90}
            paddingAngle={2}
            stroke="none"
            isAnimationActive={false}
            cursor={showControls ? "pointer" : undefined}
            onClick={(_, index) => {
              if (!showControls) return;
              const family = families[index]?.key;
              if (family) setSelectedFamily(family);
            }}
          >
            {families.map((entry, i) => (
              <Cell
                key={entry.key}
                fill={familyColors.get(entry.key) ?? COLORS[i % COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={tooltipStyle}
            itemStyle={tooltipItemStyle}
            labelStyle={tooltipItemStyle}
            formatter={(value) => [formatMetric(Number(value), metric), label]}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
