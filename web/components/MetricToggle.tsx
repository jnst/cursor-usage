import type { Metric } from "../../src/core/types.ts";

/**
 * Header control for the Selected Metric.
 *
 * This is an analysis choice, like Analysis Time Zone: one control for the
 * whole dashboard, not a per-chart view switch.
 */
export function MetricToggle({
  metric,
  onChange,
}: {
  metric: Metric;
  onChange: (metric: Metric) => void;
}) {
  return (
    <div className="metric-toggle" role="radiogroup" aria-label="Selected Metric">
      <button
        type="button"
        role="radio"
        aria-checked={metric === "cost"}
        className={metric === "cost" ? "active" : undefined}
        onClick={() => onChange("cost")}
      >
        Cost
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={metric === "tokens"}
        className={metric === "tokens" ? "active" : undefined}
        onClick={() => onChange("tokens")}
      >
        Token Count
      </button>
    </div>
  );
}
