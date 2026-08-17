import type { Metric, UsageEvent } from "../../src/core/types.ts";

import { useMemo, useState } from "react";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import {
  byModel,
  byModelFamily,
  eventsInModelFamily,
  metricValue,
} from "../../src/core/aggregate.ts";
import { formatMetric, formatTokens, formatUsd, formatUsdPerMTok } from "../../src/core/format.ts";
import { COLORS, tooltipStyle, tooltipTextStyle } from "./shared.ts";

/**
 * Model Family pie with a Model-level drilldown.
 *
 * The pie follows the selected Metric. Clicking a slice swaps the pie for a
 * table of the Models inside that family — for Auto this reveals the actual
 * Models the Router selected.
 */
export function ModelFamilyPanel({
  events,
  familyColors,
  metric,
  showControls,
  height = 280,
}: {
  events: UsageEvent[];
  familyColors: Map<string, string>;
  metric: Metric;
  showControls: boolean;
  height?: number;
}) {
  const [selectedFamily, setSelectedFamily] = useState<string | null>(null);
  const families = useMemo(() => byModelFamily(events, metric), [events, metric]);
  const models = useMemo(
    () => (selectedFamily ? byModel(eventsInModelFamily(events, selectedFamily), metric) : []),
    [events, selectedFamily, metric],
  );
  const pieKey = metric === "tokens" ? "totalTokens" : "cost";

  if (selectedFamily) {
    const familyTotal = models.reduce((sum, m) => sum + metricValue(m, metric), 0);
    const maxValue = Math.max(...models.map((m) => metricValue(m, metric)), 0);
    const familyCost = models.reduce((sum, m) => sum + m.cost, 0);
    const familyTokens = models.reduce((sum, m) => sum + m.totalTokens, 0);
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
            {formatUsd(familyCost)} · {formatTokens(familyTokens)}
            {selectedFamily === "Auto" ? " · Auto の実モデル" : ""}
          </span>
        </h3>
        <div className="table-wrap scroll">
          <table>
            <thead>
              <tr>
                <th>モデル</th>
                <th className="num">イベント</th>
                <th className="num">Token Count</th>
                <th className="num">Effective Rate</th>
                <th className="num">Cost</th>
              </tr>
            </thead>
            <tbody>
              {models.length === 0 ? (
                <tr>
                  <td colSpan={5}>この分類のイベントはありません。</td>
                </tr>
              ) : (
                models.map((m) => {
                  const value = metricValue(m, metric);
                  const share =
                    familyTotal > 0 ? ` ${Math.round((value / familyTotal) * 100)}%` : "";
                  const bar = (active: boolean) =>
                    active ? (
                      <span
                        className="cost-bar"
                        style={{ width: maxValue > 0 ? `${(value / maxValue) * 96}px` : 0 }}
                      />
                    ) : null;
                  return (
                    <tr key={m.key}>
                      <td>
                        <span className="badge">{m.key}</span>
                      </td>
                      <td className="num">{m.eventCount}</td>
                      <td className="num">
                        {bar(metric === "tokens")}
                        {formatTokens(m.totalTokens)}
                        {metric === "tokens" ? <span className="share">{share}</span> : null}
                      </td>
                      <td className="num">{formatUsdPerMTok(m.cost, m.totalTokens)}</td>
                      <td className="num">
                        {bar(metric === "cost")}
                        {formatUsd(m.cost)}
                        {metric === "cost" ? <span className="share">{share}</span> : null}
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
        {metric === "cost" ? "モデル分類別コスト" : "モデル分類別トークン"}
        {showControls && <span className="hint">クリックで実モデルの内訳へ</span>}
      </h3>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={families}
            dataKey={pieKey}
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
            itemStyle={tooltipTextStyle}
            labelStyle={tooltipTextStyle}
            formatter={(value) => formatMetric(Number(value), metric)}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
