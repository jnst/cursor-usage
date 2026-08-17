import type { DisplayMetric } from "../../src/core/types.ts";

const OPTIONS: { value: DisplayMetric; label: string }[] = [
  { value: "cost", label: "Cost" },
  { value: "tokens", label: "Tokens" },
];

/**
 * Segmented Cost / Tokens control for dashboard charts.
 *
 * One toggle drives the Overview and Daily Window charts so switching twice
 * compares the same Daily Window columns by visual memory.
 */
export function MetricToggle({
  metric,
  onChange,
  disabled,
}: {
  metric: DisplayMetric;
  onChange?: (metric: DisplayMetric) => void;
  disabled?: boolean;
}) {
  return (
    <div className="metric-toggle" role="radiogroup" aria-label="表示尺度">
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
