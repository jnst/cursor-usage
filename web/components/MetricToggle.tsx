import type { Metric } from "../../src/core/types.ts";

/**
 * Full-width analysis tabs for the Selected Metric.
 *
 * This is an analysis choice, like Analysis Time Zone: one control for the
 * whole dashboard, not a per-chart view switch. Rendering it as tabs above
 * the content signals that everything below follows the selection.
 */
export function MetricToggle({
  metric,
  onChange,
}: {
  metric: Metric;
  onChange: (metric: Metric) => void;
}) {
  return (
    <div className="metric-tabs" role="tablist" aria-label="Selected Metric">
      <button
        type="button"
        role="tab"
        aria-selected={metric === "cost"}
        className={metric === "cost" ? "active" : undefined}
        onClick={() => onChange("cost")}
      >
        コスト
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={metric === "tokens"}
        className={metric === "tokens" ? "active" : undefined}
        onClick={() => onChange("tokens")}
      >
        トークン
      </button>
    </div>
  );
}
