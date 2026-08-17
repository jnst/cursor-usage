import type { Metric } from "../../src/core/types.ts";

const OPTIONS: { value: Metric; label: string }[] = [
  { value: "cost", label: "Cost" },
  { value: "tokens", label: "Token Count" },
];

/**
 * Header control for the selected analysis Metric.
 *
 * One control drives ranking, bars, pies, tables, and summaries in both the
 * Overview and Daily Window views.
 */
export function MetricToggle({
  metric,
  onChange,
  disabled,
}: {
  metric: Metric;
  onChange?: (metric: Metric) => void;
  disabled?: boolean;
}) {
  return (
    <div className="metric-toggle" role="radiogroup" aria-label="Metric">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={metric === option.value}
          disabled={disabled}
          onClick={() => onChange?.(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
