import type { Metric, UsageEvent } from "../../src/core/types.ts";

import { useMemo, useState } from "react";
import { Cell, DefaultTooltipContent, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { byModel, byModelFamily, eventsInModelFamily } from "../../src/core/aggregate.ts";
import { useLanguage } from "../i18n/LanguageProvider.tsx";
import { useCostVisibility } from "./CostVisibility.tsx";
import { COLORS, tooltipItemStyle, tooltipStyle } from "./shared.ts";

/**
 * Model Family pie with a Model-level drilldown.
 *
 * The pie groups the Selected Metric by Model Family (Auto is one Router-level
 * slice). Clicking a slice swaps the pie for a table of the Models inside that
 * family — for Auto this reveals the actual Models the Router selected.
 */
export function ModelFamilyPanel({
  events,
  familyColors,
  showControls,
}: {
  events: UsageEvent[];
  familyColors: Map<string, string>;
  showControls: boolean;
}) {
  const { t } = useLanguage();
  const { formatValue: formatMetric } = useCostVisibility();
  const [metric, setMetric] = useState<Metric>("cost");
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
  const label = t(metric === "tokens" ? "Tokens" : "Spend");
  const metricToggle = showControls && (
    <div className="model-metric-toggle" role="group" aria-label={t("Metric for Model breakdown")}>
      {(["cost", "tokens"] as const).map((value) => (
        <button
          key={value}
          type="button"
          aria-pressed={metric === value}
          onClick={() => setMetric(value)}
        >
          {t(value === "cost" ? "Spend" : "Tokens")}
        </button>
      ))}
    </div>
  );

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
            aria-label={t("Back to Model Families")}
          >
            ←
          </button>
          {t("familyBreakdown", { family: selectedFamily })}
          <span className="hint">
            {t("byModel", { value: formatMetric(familyTotal, metric) })}
            {selectedFamily === "Auto" ? t(" (Models routed through Auto)") : ""}
          </span>
        </h3>
        {metricToggle}
        <div className="table-wrap scroll">
          <table>
            <thead>
              <tr>
                <th>{t("Model")}</th>
                <th className="num">{t("Events")}</th>
                <th className="num">{label}</th>
              </tr>
            </thead>
            <tbody>
              {models.length === 0 ? (
                <tr>
                  <td colSpan={3}>{t("There are no events in this Model Family.")}</td>
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
    <div className="panel model-family-panel">
      <h3>
        {t(metric === "tokens" ? "Tokens by Model Family" : "Spend by Model Family")}
        {showControls && <span className="hint">{t("Click for the Model breakdown")}</span>}
      </h3>
      {metricToggle}
      <div className="model-family-chart">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={families}
              dataKey="value"
              nameKey="key"
              innerRadius="52%"
              outerRadius="90%"
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
              content={(props) => {
                const item = props.payload?.[0];
                if (!props.active || !item) return null;
                return (
                  <DefaultTooltipContent
                    {...props}
                    label={String(item.name)}
                    payload={[{ ...item, name: t(metric === "tokens" ? "Tokens" : "Spend") }]}
                    formatter={(value) => formatMetric(Number(value), metric)}
                  />
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="model-family-legend" aria-label={t("Model Family legend")}>
        {families.map((family, i) => (
          <li key={family.key} title={family.key}>
            <i style={{ background: familyColors.get(family.key) ?? COLORS[i % COLORS.length] }} />
            <span>{family.key}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
