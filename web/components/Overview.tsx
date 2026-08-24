import type { AnalysisContext, Metric, UsageEvent } from "../../src/core/types.ts";

import { useMemo } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
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
  formatDateTime,
  formatMetric,
  formatTokens,
  formatUsd,
  formatUsdPerMTok,
} from "../../src/core/format.ts";
import { EventsTable } from "./EventsTable.tsx";
import { ModelFamilyPanel } from "./ModelFamilyPanel.tsx";
import {
  BAR_SIZE,
  COLORS,
  EFFECTIVE_RATE_HOVER_LABEL,
  metricHoverLabel,
  modelFamilyColors,
} from "./shared.ts";
import { SummaryCards } from "./SummaryCards.tsx";
import { UserChart } from "./UserChart.tsx";

const CUMULATIVE_KEY = "cumulative";

function DailyWindowAxisTick({ x, y, payload, fill }: XAxisTickContentProps) {
  const { date, weekday } = formatDailyWindowAxis(String(payload.value));
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
 * rows. Only the family list scrolls, so 合計 / コスト or トークン / 実効レート /
 * 累積 stay visible when many families share a day.
 */
function DailyMetricTooltip({
  metric,
  payload,
  label,
  active,
}: TooltipContentProps & { metric: Metric }) {
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
          <span className="chart-tooltip-name">合計</span>
          <span className="chart-tooltip-value">{formatMetric(total, metric)}</span>
        </li>
        <li>
          <span className="chart-tooltip-name">{metricHoverLabel(otherMetric)}</span>
          <span className="chart-tooltip-value">{formatMetric(otherTotal, otherMetric)}</span>
        </li>
        <li>
          <span className="chart-tooltip-name">{EFFECTIVE_RATE_HOVER_LABEL}</span>
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

function OverviewSummary({
  events,
  ctx,
  metric,
}: {
  events: UsageEvent[];
  ctx: AnalysisContext;
  metric: Metric;
}) {
  const s = useMemo(() => summarize(events, ctx), [events, ctx]);
  const primaryValue = metric === "tokens" ? s.totalTokens : s.totalCost;
  const secondaryValue = metric === "tokens" ? s.totalCost : s.totalTokens;
  const avg =
    s.dailyWindowCount > 0
      ? (metric === "tokens" ? s.totalTokens : s.totalCost) / s.dailyWindowCount
      : 0;
  return (
    <SummaryCards
      cards={[
        {
          label: metric === "tokens" ? "Total Tokens" : "Total Cost",
          value: formatMetric(primaryValue, metric),
          sub: `${s.firstDailyWindow} – ${s.lastDailyWindow}`,
        },
        {
          label: metric === "tokens" ? "Total Cost" : "Total Tokens",
          value: metric === "tokens" ? formatUsd(secondaryValue) : formatTokens(secondaryValue),
          sub: `${s.eventCount} events`,
        },
        {
          label: "Effective Rate",
          value: formatUsdPerMTok(s.totalCost, s.totalTokens),
          sub: "$ / MTok",
        },
        {
          label: metric === "tokens" ? "Avg Daily Token Count" : "Avg Daily Cost",
          value: formatMetric(avg, metric),
          sub: `${s.dailyWindowCount} active windows`,
        },
        {
          label: "Models",
          value: String(s.modelCount),
          sub: "in this export",
        },
        {
          label: "Users",
          value: String(s.userCount),
          sub: "in this export",
        },
      ]}
    />
  );
}

function DailyChart({
  events,
  scaleEvents,
  ctx,
  metric,
  familyColors,
  showControls,
  onSelectDailyWindow,
}: {
  events: UsageEvent[];
  scaleEvents: UsageEvent[];
  ctx: AnalysisContext;
  metric: Metric;
  familyColors: Map<string, string>;
  showControls: boolean;
  onSelectDailyWindow?: (dailyWindow: string) => void;
}) {
  const families = useMemo(() => byModelFamily(events, metric).map((f) => f.key), [events, metric]);
  const data = useMemo(() => {
    let cumulative = 0;
    return includeEmptyDailyWindowCosts(byDailyWindowAndModelFamily(events, ctx)).map((d) => {
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
  }, [events, ctx, metric]);
  const scale = useMemo(() => {
    const dailyWindows = byDailyWindowAndModelFamily(scaleEvents, ctx);
    const totals = dailyWindows.map((d) => dailyWindowMetricTotal(d, metric));
    return {
      maxDaily: Math.max(...totals, 0),
      total: totals.reduce((sum, value) => sum + value, 0),
    };
  }, [scaleEvents, ctx, metric]);

  const handleClick = (payload: { dailyWindow?: string } | undefined) => {
    if (payload?.dailyWindow) onSelectDailyWindow?.(payload.dailyWindow);
  };

  return (
    <div className="panel wide">
      <h3>
        日別{metric === "tokens" ? "トークン" : "コスト"}推移(モデル分類別積み上げ + 累積)
        {showControls && onSelectDailyWindow && (
          <span className="hint">バーをクリックで詳細へ</span>
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
            tick={DailyWindowAxisTick}
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
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {families.map((family, i) => (
            <Bar
              key={family}
              yAxisId="metric"
              dataKey={family}
              stackId="metric"
              fill={familyColors.get(family) ?? COLORS[i % COLORS.length]}
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
            name="累積"
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
 * unselected users together. Charts and rankings follow the Selected Metric.
 */
export function Overview({
  events,
  userEvents,
  ctx,
  metric,
  showControls,
  onSelectDailyWindow,
  onSelectUser,
  selectedUser,
}: {
  events: UsageEvent[];
  userEvents: UsageEvent[];
  ctx: AnalysisContext;
  metric: Metric;
  showControls: boolean;
  onSelectDailyWindow?: (dailyWindow: string) => void;
  onSelectUser?: (user: string) => void;
  selectedUser: string | null;
}) {
  const familyColors = useMemo(() => modelFamilyColors(userEvents), [userEvents]);
  const top = useMemo(() => topEvents(events, 20, metric), [events, metric]);
  return (
    <>
      <OverviewSummary events={events} ctx={ctx} metric={metric} />
      <div className="grid">
        <DailyChart
          events={events}
          scaleEvents={userEvents}
          ctx={ctx}
          metric={metric}
          familyColors={familyColors}
          showControls={showControls}
          onSelectDailyWindow={onSelectDailyWindow}
        />
        <ModelFamilyPanel
          events={events}
          metric={metric}
          familyColors={familyColors}
          showControls={showControls}
        />
        <UserChart
          events={userEvents}
          metric={metric}
          selectedUser={selectedUser}
          showControls={showControls}
          onSelectUser={onSelectUser}
        />
        <EventsTable
          events={top}
          timeZone={ctx.timeZone}
          title={metric === "tokens" ? "高トークンイベント Top 20" : "高コストイベント Top 20"}
          timeHeader={`日時 (${ctx.timeZone})`}
          formatTimestamp={formatDateTime}
        />
      </div>
    </>
  );
}
