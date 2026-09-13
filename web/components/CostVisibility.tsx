import type { Metric } from "../../src/core/types.ts";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import { formatMetric, formatUsd } from "../../src/core/format.ts";
import { useLanguage } from "../i18n/LanguageProvider.tsx";
import { TooltipButton } from "./TooltipButton.tsx";

export const HIDDEN_COST = "***";
const Context = createContext({ hidden: false, toggle: () => {} });

export function CostVisibilityProvider({ children }: { children: ReactNode }) {
  const [hidden, setHidden] = useState(() => window.__CURSOR_USAGE_HIDE_COSTS__ === true);
  return (
    <Context.Provider value={{ hidden, toggle: () => setHidden((value) => !value) }}>
      {children}
    </Context.Provider>
  );
}

/** Mask displayed totals and individual costs; callers format averages/rates normally. */
export function useCostVisibility() {
  const { hidden, toggle } = useContext(Context);
  return useMemo(
    () => ({
      hidden,
      toggle,
      formatCost: (value: number, options: { trimZeroCents?: boolean } = {}) =>
        hidden ? HIDDEN_COST : formatUsd(value, options),
      formatAxisValue: (
        value: number,
        metric: Metric,
        options: { trimZeroCents?: boolean } = {},
      ) => (hidden && metric === "cost" ? "" : formatMetric(value, metric, options)),
      formatValue: (value: number, metric: Metric, options: { trimZeroCents?: boolean } = {}) =>
        hidden && metric === "cost" ? HIDDEN_COST : formatMetric(value, metric, options),
    }),
    [hidden, toggle],
  );
}

export function CostVisibilityToggle() {
  const { t } = useLanguage();
  const { hidden, toggle } = useCostVisibility();
  return (
    <TooltipButton
      type="button"
      className="reload-button cost-visibility-toggle"
      aria-label={t(hidden ? "Show Spend" : "Hide Spend")}
      aria-pressed={hidden}
      onClick={toggle}
    >
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        aria-hidden="true"
      >
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
        {hidden && <path d="m3 3 18 18" />}
      </svg>
    </TooltipButton>
  );
}
