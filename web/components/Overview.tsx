import type { AnalysisContext, Metric, UsageEvent } from "../../src/core/types.ts";

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
import { CloudAgentAnalysis } from "./CloudAgentAnalysis.tsx";
import { useCostVisibility } from "./CostVisibility.tsx";
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
import { UserRankings } from "./UserRankings.tsx";

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
 * rows. Only the family list scrolls, so 合計 / Spend or Tokens / 実効レート /
 * 累積 stay visible when many families share a day.
 */
function DailyMetricTooltip({
  metric,
  payload,
  label,
  active,
}: TooltipContentProps & { metric: Metric }) {
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

function OverviewSummary({ events, ctx }: { events: UsageEvent[]; ctx: AnalysisContext }) {
  const { formatCost } = useCostVisibility();
  const s = useMemo(() => summarize(events, ctx), [events, ctx]);
  return (
    <SummaryCards
      cards={[
        {
          label: "Total Spend",
          value: formatCost(s.totalCost),
          sub: formatDailyWindowRange(s.firstDailyWindow, s.lastDailyWindow),
        },
        {
          label: "Total Tokens",
          value: formatTokens(s.totalTokens),
          sub: `${s.eventCount} events`,
        },
        {
          label: "Effective Rate",
          value: formatUsdPerMTok(s.totalCost, s.totalTokens),
          sub: "$ / MTok",
        },
        {
          label: "Avg Daily Spend",
          value: formatUsd(s.avgCostPerActiveDailyWindow),
          sub: `${s.dailyWindowCount} active windows`,
        },
        {
          label: "Avg Daily Tokens",
          value: formatTokens(s.dailyWindowCount ? s.totalTokens / s.dailyWindowCount : 0),
          sub: `${s.modelCount} models · ${s.userCount} users`,
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
  const { formatAxisValue: formatMetric } = useCostVisibility();
  const families = useMemo(() => byModelFamily(events).map((f) => f.key), [events]);
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
        日別{metric === "tokens" ? "Tokens" : "Spend"}推移
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
  const familyColors = useMemo(() => modelFamilyColors(userEvents), [userEvents]);
  const families = useMemo(() => byModelFamily(events), [events]);
  const top = useMemo(
    () =>
      [...new Set([...topEvents(events, 20, "cost"), ...topEvents(events, 20, "tokens")])].sort(
        (a, b) => b.cost - a.cost,
      ),
    [events],
  );
  return (
    <>
      {selectedUser && <p className="meta">選択中のユーザー: {selectedUser}</p>}
      <OverviewSummary events={events} ctx={ctx} />
      <div className="grid">
        {(["cost", "tokens"] as const).map((metric) => (
          <DailyChart
            key={metric}
            events={events}
            scaleEvents={userEvents}
            ctx={ctx}
            metric={metric}
            familyColors={familyColors}
            showControls={showControls}
            onSelectDailyWindow={onSelectDailyWindow}
          />
        ))}
        <div className="family-legend wide" aria-label="モデル分類の共通凡例">
          {families.map((family) => (
            <span key={family.key}>
              <i style={{ background: familyColors.get(family.key) }} />
              {family.key}
            </span>
          ))}
          <span>
            <i style={{ background: "#e6edf3" }} />
            累積（右軸）
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
            title="Spend・Tokens 上位イベント 各 Top 20（重複を除く）"
            timeHeader={`日時 (${ctx.timeZone})`}
            formatTimestamp={formatDateTime}
          />
        </div>
      </div>
    </>
  );
}
