import type { DisplayMetric, UsageEvent } from "../../src/core/types.ts";

import { useMemo, useState } from "react";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { byModel, byModelFamily, eventsInModelFamily } from "../../src/core/aggregate.ts";
import { formatMetric, formatTokens, formatUsd, formatUsdPerMTok } from "../../src/core/format.ts";
import { COLORS, tooltipStyle } from "./shared.ts";

/**
 * Model Family pie with a Model-level drilldown.
 *
 * The pie follows the selected Display Metric. The drilldown table always
 * shows Cost, Tokens, and Effective Rate so the mix stays readable.
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
  metric: DisplayMetric;
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
    const familyCost = models.reduce((sum, m) => sum + m.cost, 0);
    const familyTokens = models.reduce((sum, m) => sum + m.totalTokens, 0);
    const maxCost = Math.max(...models.map((m) => m.cost), 0);
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
                <th className="num">Tokens</th>
                <th className="num">$/MTok</th>
                <th className="num">Cost</th>
              </tr>
            </thead>
            <tbody>
              {models.length === 0 ? (
                <tr>
                  <td colSpan={5}>この分類のイベントはありません。</td>
                </tr>
              ) : (
                models.map((m) => (
                  <tr key={m.key}>
                    <td>
                      <span className="badge">{m.key}</span>
                    </td>
                    <td className="num">{m.eventCount}</td>
                    <td className="num">{formatTokens(m.totalTokens)}</td>
                    <td className="num">{formatUsdPerMTok(m.cost, m.totalTokens)}</td>
                    <td className="num">
                      <span
                        className="cost-bar"
                        style={{ width: maxCost > 0 ? `${(m.cost / maxCost) * 96}px` : 0 }}
                      />
                      {formatUsd(m.cost)}
                      <span className="share">
                        {familyCost > 0 ? ` ${Math.round((m.cost / familyCost) * 100)}%` : ""}
                      </span>
                    </td>
                  </tr>
                ))
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
            formatter={(value) => formatMetric(Number(value), metric)}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
