import type {
  AnalysisContext,
  BucketStat,
  DailyWindowCostStat,
  Metric,
  UsageEvent,
} from "../../src/core/types.ts";

import { useMemo } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
  type XAxisTickContentProps,
} from "recharts";

import {
  byDailyWindowAndModelFamily,
  byModelFamily,
  dailyWindowMetricByKey,
  dailyWindowMetricTotal,
  includeEmptyDailyWindowCosts,
  summarize,
  topEvents,
} from "../../src/core/aggregate.ts";
import {
  formatDailyWindowAxis,
  formatDailyWindowRange,
  formatDateTime,
  formatTokens,
  formatUsd,
  formatUsdPerMTok,
} from "../../src/core/format.ts";
import { useLanguage } from "../i18n/LanguageProvider.tsx";
import { CloudAgentAnalysis } from "./CloudAgentAnalysis.tsx";
import { useCostVisibility } from "./CostVisibility.tsx";
import { EventsTable } from "./EventsTable.tsx";
import { ModelFamilyPanel } from "./ModelFamilyPanel.tsx";
import { BAR_SIZE, COLORS, modelFamilyColors } from "./shared.ts";
import { SummaryCards } from "./SummaryCards.tsx";
import { UserRankings } from "./UserRankings.tsx";

const CUMULATIVE_KEY = "cumulative";

function DailyWindowAxisTick({ x, y, payload, fill }: XAxisTickContentProps) {
  const { language } = useLanguage();
  const { date, weekday } = formatDailyWindowAxis(String(payload.value), language);
  return (
    <text x={x} y={y} textAnchor="middle" fill={fill} fontSize={12}>
      <tspan x={x} dy={12}>
        {date}
      </tspan>
      <tspan x={x} dy={14} fontSize={10}>
        {weekday}
      </tspan>
    </text>
  );
}

/**
 * Daily tooltip: stacked families (bar bottom → top), then the day-level
 * rows. Only the family list scrolls, so totals, Metrics, Effective Rate and
 * cumulative values stay visible when many families share a Daily Window.
 */
function DailyMetricTooltip({
  metric,
  payload,
  label,
  active,
}: TooltipContentProps & { metric: Metric }) {
  const { t } = useLanguage();
  const { formatValue: formatMetric } = useCostVisibility();
  if (!active || !payload?.length) return null;

  // Recharts lists stacked series top-first. Reverse so the tooltip matches
  // the bar and legend: first family is the bottom segment.
  const modelItems = payload
    .filter((item) => item.dataKey !== CUMULATIVE_KEY && Number(item.value) > 0)
    .toReversed();
  const cumulativeItem = payload.find((item) => item.dataKey === CUMULATIVE_KEY);
  const row = payload[0]?.payload as
    | { dailyWindow?: string; total?: number; totalCost?: number; totalTokens?: number }
    | undefined;
  const total =
    typeof row?.total === "number"
      ? row.total
      : modelItems.reduce((sum, item) => sum + Number(item.value ?? 0), 0);
  const totalCost = row?.totalCost ?? 0;
  const totalTokens = row?.totalTokens ?? 0;
  const otherMetric: Metric = metric === "cost" ? "tokens" : "cost";
  const otherTotal = metric === "cost" ? totalTokens : totalCost;

  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-label">{row?.dailyWindow ?? label}</div>
      {modelItems.length > 0 && (
        <ul className="chart-tooltip-models">
          {modelItems.map((item) => (
            <li key={String(item.dataKey)}>
              <span
                className="chart-tooltip-swatch"
                style={{ background: String(item.color ?? item.fill ?? "#8b949e") }}
              />
              <span className="chart-tooltip-name">{item.name}</span>
              <span className="chart-tooltip-value">
                {formatMetric(Number(item.value), metric)}
              </span>
            </li>
          ))}
        </ul>
      )}
      <ul className="chart-tooltip-summary">
        <li>
          <span className="chart-tooltip-name">{t("Total")}</span>
          <span className="chart-tooltip-value">{formatMetric(total, metric)}</span>
        </li>
        <li>
          <span className="chart-tooltip-name">
            {t(otherMetric === "tokens" ? "Tokens" : "Spend")}
          </span>
          <span className="chart-tooltip-value">{formatMetric(otherTotal, otherMetric)}</span>
        </li>
        <li>
          <span className="chart-tooltip-name">{t("Effective Rate")}</span>
          <span className="chart-tooltip-value">{formatUsdPerMTok(totalCost, totalTokens)}</span>
        </li>
        {cumulativeItem && (
          <li>
            <span className="chart-tooltip-name">{cumulativeItem.name}</span>
            <span className="chart-tooltip-value">
              {formatMetric(Number(cumulativeItem.value), metric)}
            </span>
          </li>
        )}
      </ul>
    </div>
  );
}

function OverviewSummary({ events, ctx }: { events: UsageEvent[]; ctx: AnalysisContext }) {
  const { t } = useLanguage();
  const { formatCost } = useCostVisibility();
  const s = useMemo(() => summarize(events, ctx), [events, ctx]);
  return (
    <SummaryCards
      cards={[
        {
          label: t("Total Spend"),
          value: formatCost(s.totalCost),
          sub: formatDailyWindowRange(s.firstDailyWindow, s.lastDailyWindow),
        },
        {
          label: t("Total Tokens"),
          value: formatTokens(s.totalTokens),
          sub: t("eventCount", { count: s.eventCount }),
        },
        {
          label: t("Effective Rate"),
          value: formatUsdPerMTok(s.totalCost, s.totalTokens),
          sub: "$ / MTok",
        },
        {
          label: t("Avg Daily Spend"),
          value: formatUsd(s.avgCostPerActiveDailyWindow),
          sub: t("activeWindows", { count: s.dailyWindowCount }),
        },
        {
          label: t("Avg Daily Tokens"),
          value: formatTokens(s.dailyWindowCount ? s.totalTokens / s.dailyWindowCount : 0),
          sub: t("modelsUsers", { models: s.modelCount, users: s.userCount }),
        },
      ]}
    />
  );
}

function DailyChart({
  dailyWindows,
  scaleDailyWindows,
  families,
  metric,
  familyColors,
  showControls,
  onSelectDailyWindow,
}: {
  dailyWindows: DailyWindowCostStat[];
  scaleDailyWindows: DailyWindowCostStat[];
  families: BucketStat[];
  metric: Metric;
  familyColors: Map<string, string>;
  showControls: boolean;
  onSelectDailyWindow?: (dailyWindow: string) => void;
}) {
  const { t } = useLanguage();
  const { formatAxisValue: formatMetric } = useCostVisibility();
  const data = useMemo(() => {
    let cumulative = 0;
    return dailyWindows.map((d) => {
      const total = dailyWindowMetricTotal(d, metric);
      cumulative += total;
      return {
        dailyWindow: d.dailyWindow,
        ...dailyWindowMetricByKey(d, metric),
        total,
        totalCost: d.totalCost,
        totalTokens: d.totalTokens,
        cumulative,
      };
    });
  }, [dailyWindows, metric]);
  const scale = useMemo(() => {
    const totals = scaleDailyWindows.map((d) => dailyWindowMetricTotal(d, metric));
    return {
      maxDaily: Math.max(...totals, 0),
      total: totals.reduce((sum, value) => sum + value, 0),
    };
  }, [scaleDailyWindows, metric]);

  const handleClick = (payload: { dailyWindow?: string } | undefined) => {
    if (payload?.dailyWindow) onSelectDailyWindow?.(payload.dailyWindow);
  };

  return (
    <div className="panel wide">
      <h3>
        {t(metric === "tokens" ? "Tokens by Daily Window" : "Spend by Daily Window")}
        {showControls && onSelectDailyWindow && (
          <span className="hint">{t("Click a bar for details")}</span>
        )}
      </h3>
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={data}>
          <CartesianGrid stroke="#21262d" vertical={false} />
          <XAxis
            dataKey="dailyWindow"
            stroke="#8b949e"
            height={40}
            interval={0}
            minTickGap={0}
            tick={(props) => <DailyWindowAxisTick {...props} />}
          />
          <YAxis
            yAxisId="metric"
            domain={[0, scale.maxDaily]}
            stroke="#8b949e"
            fontSize={12}
            tickFormatter={(value) => formatMetric(Number(value), metric, { trimZeroCents: true })}
          />
          <YAxis
            yAxisId="cumulative"
            domain={[0, scale.total]}
            orientation="right"
            stroke="#8b949e"
            fontSize={12}
            tickFormatter={(value) => formatMetric(Number(value), metric, { trimZeroCents: true })}
          />
          <Tooltip
            content={(props) => <DailyMetricTooltip {...props} metric={metric} />}
            allowEscapeViewBox={{ x: true, y: true }}
            wrapperStyle={{ zIndex: 20, pointerEvents: "auto" }}
          />
          {families.map((family, i) => (
            <Bar
              key={family.key}
              yAxisId="metric"
              dataKey={family.key}
              stackId="metric"
              fill={familyColors.get(family.key) ?? COLORS[i % COLORS.length]}
              cursor={showControls && onSelectDailyWindow ? "pointer" : undefined}
              onClick={(payload) => handleClick(payload as { dailyWindow?: string } | undefined)}
              isAnimationActive={false}
              barSize={BAR_SIZE}
              maxBarSize={BAR_SIZE}
            />
          ))}
          <Line
            yAxisId="cumulative"
            dataKey={CUMULATIVE_KEY}
            name={t("Cumulative")}
            stroke="#e6edf3"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Shows the top-level analysis for the loaded Usage Export.
 *
 * `events` is the currently filtered analysis set. `userEvents` keeps the
 * unfiltered User comparison set so the User chart can show selected and
 * unselected users together. Spend and Tokens are shown together.
 */
export function Overview({
  events,
  userEvents,
  ctx,
  showControls,
  onSelectDailyWindow,
  onSelectUser,
  selectedUser,
}: {
  events: UsageEvent[];
  userEvents: UsageEvent[];
  ctx: AnalysisContext;
  showControls: boolean;
  onSelectDailyWindow?: (dailyWindow: string) => void;
  onSelectUser?: (user: string) => void;
  selectedUser: string | null;
}) {
  const { t } = useLanguage();
  const familyColors = useMemo(() => modelFamilyColors(userEvents), [userEvents]);
  const families = useMemo(() => byModelFamily(events), [events]);
  // Spend, Tokens, and their axes share the same aggregate rows. Without a
  // User filter, the comparison set is also identical to the displayed set.
  const dailyWindows = useMemo(
    () => includeEmptyDailyWindowCosts(byDailyWindowAndModelFamily(events, ctx)),
    [events, ctx],
  );
  const scaleDailyWindows = useMemo(
    () => (userEvents === events ? dailyWindows : byDailyWindowAndModelFamily(userEvents, ctx)),
    [userEvents, events, dailyWindows, ctx],
  );
  const top = useMemo(
    () =>
      [...new Set([...topEvents(events, 20, "cost"), ...topEvents(events, 20, "tokens")])].sort(
        (a, b) => b.cost - a.cost,
      ),
    [events],
  );
  return (
    <>
      {selectedUser && <p className="meta">{t("selectedUser", { user: selectedUser })}</p>}
      <OverviewSummary events={events} ctx={ctx} />
      <div className="grid">
        {(["cost", "tokens"] as const).map((metric) => (
          <DailyChart
            key={metric}
            dailyWindows={dailyWindows}
            scaleDailyWindows={scaleDailyWindows}
            families={families}
            metric={metric}
            familyColors={familyColors}
            showControls={showControls}
            onSelectDailyWindow={onSelectDailyWindow}
          />
        ))}
        <div className="family-legend wide" aria-label={t("Shared Model Family legend")}>
          {families.map((family) => (
            <span key={family.key}>
              <i style={{ background: familyColors.get(family.key) }} />
              {family.key}
            </span>
          ))}
          <span>
            <i style={{ background: "#e6edf3" }} />
            {t("Cumulative (right axis)")}
          </span>
        </div>
        <div className="breakdown-grid wide">
          <ModelFamilyPanel
            events={events}
            familyColors={familyColors}
            showControls={showControls}
          />
          <UserRankings
            events={userEvents}
            selectedUser={selectedUser}
            showControls={showControls}
            onSelectUser={onSelectUser}
          />
        </div>
      </div>
      <div className="analysis-details">
        <div className="grid">
          <CloudAgentAnalysis events={events} ctx={ctx} />
          <EventsTable
            events={top}
            timeZone={ctx.timeZone}
            title={t("Top 20 events each by Spend and Tokens (duplicates removed)")}
            timeHeader={t("dateTime", { zone: ctx.timeZone })}
            formatTimestamp={formatDateTime}
          />
        </div>
      </div>
    </>
  );
}
