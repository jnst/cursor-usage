import type { AnalysisContext, Metric, UsageEvent } from "../../src/core/types.ts";

import { useMemo } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  DefaultTooltipContent,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";

import {
  byDailyWindowAndModelFamily,
  byModelFamily,
  dailyWindowMetricByKey,
  dailyWindowMetricTotal,
  summarize,
  topEvents,
} from "../../src/core/aggregate.ts";
import {
  formatDateTime,
  formatMetric,
  formatTokens,
  formatUsd,
  formatUsdPerMTok,
  metricLabel,
} from "../../src/core/format.ts";
import { EventsTable } from "./EventsTable.tsx";
import { ModelFamilyPanel } from "./ModelFamilyPanel.tsx";
import { BAR_SIZE, COLORS, modelFamilyColors, tooltipStyle, tooltipTextStyle } from "./shared.ts";
import { SummaryCards } from "./SummaryCards.tsx";
import { UserChart } from "./UserChart.tsx";

const CUMULATIVE_KEY = "cumulative";

/**
 * Daily tooltip: model breakdown → selected total → other metric → rate → cumulative.
 * Order follows aggregation granularity (fine → coarse), then the contrast metric.
 */
function DailyMetricTooltip({ metric, ...props }: TooltipContentProps & { metric: Metric }) {
  const { active, payload } = props;
  if (!active || !payload?.length) return null;

  const modelItems = payload.filter((item) => item.dataKey !== CUMULATIVE_KEY);
  const cumulativeItem = payload.find((item) => item.dataKey === CUMULATIVE_KEY);
  const row = payload[0]?.payload as
    | { total?: number; totalCost?: number; totalTokens?: number }
    | undefined;
  const total =
    typeof row?.total === "number"
      ? row.total
      : modelItems.reduce((sum, item) => sum + Number(item.value ?? 0), 0);
  const totalCost = row?.totalCost ?? 0;
  const totalTokens = row?.totalTokens ?? 0;

  const template = modelItems[0] ?? cumulativeItem;
  if (!template) return null;

  const otherMetric: Metric = metric === "cost" ? "tokens" : "cost";
  const otherTotal = metric === "cost" ? totalTokens : totalCost;

  const orderedPayload = [
    ...modelItems,
    {
      ...template,
      dataKey: "total",
      name: "合計",
      value: total,
      color: "#e6edf3",
      fill: "#e6edf3",
    },
    {
      ...template,
      dataKey: "other",
      name: metricLabel(otherMetric),
      value: otherTotal,
      color: "#8b949e",
      fill: "#8b949e",
    },
    {
      ...template,
      dataKey: "rate",
      name: "$/MTok",
      value: formatUsdPerMTok(totalCost, totalTokens),
      color: "#8b949e",
      fill: "#8b949e",
    },
    ...(cumulativeItem ? [cumulativeItem] : []),
  ];

  return (
    <DefaultTooltipContent
      {...props}
      payload={orderedPayload}
      formatter={(value, name, item) => {
        const key = String(item?.dataKey ?? name);
        if (key === "rate") return String(value);
        if (key === "other") return formatMetric(Number(value), otherMetric);
        return formatMetric(Number(value), metric);
      }}
      itemSorter={undefined}
    />
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
  const range = `${s.firstDailyWindow} – ${s.lastDailyWindow}`;
  const costCard = {
    label: "Total Cost",
    value: formatUsd(s.totalCost),
    sub: metric === "cost" ? range : `${s.eventCount} events`,
  };
  const tokenCard = {
    label: "Total Tokens",
    value: formatTokens(s.totalTokens),
    sub: metric === "tokens" ? range : `${s.eventCount} events`,
  };
  const avgActive =
    metric === "tokens"
      ? {
          label: "Avg Tokens / Active Daily Window",
          value: formatTokens(s.dailyWindowCount > 0 ? s.totalTokens / s.dailyWindowCount : 0),
          sub: `${s.dailyWindowCount} active windows`,
        }
      : {
          label: "Avg Cost / Active Daily Window",
          value: formatUsd(s.avgCostPerActiveDailyWindow),
          sub: `${s.dailyWindowCount} active windows`,
        };
  return (
    <SummaryCards
      cards={[
        metric === "tokens" ? tokenCard : costCard,
        metric === "tokens" ? costCard : tokenCard,
        {
          label: "Effective Rate",
          value: formatUsdPerMTok(s.totalCost, s.totalTokens),
          sub: "$ / MTok",
        },
        avgActive,
        { label: "Max Mode", value: `${Math.round(s.maxModeRatio * 100)}%`, sub: "of events" },
        {
          label: "Users / Models",
          value: `${s.userCount} / ${s.modelCount}`,
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
  familyColors,
  metric,
  showControls,
  onSelectDailyWindow,
}: {
  events: UsageEvent[];
  scaleEvents: UsageEvent[];
  ctx: AnalysisContext;
  familyColors: Map<string, string>;
  metric: Metric;
  showControls: boolean;
  onSelectDailyWindow?: (dailyWindow: string) => void;
}) {
  const families = useMemo(() => byModelFamily(events, metric).map((f) => f.key), [events, metric]);
  const data = useMemo(() => {
    let cumulative = 0;
    return byDailyWindowAndModelFamily(events, ctx).map((d) => {
      const total = dailyWindowMetricTotal(d, metric);
      cumulative += total;
      return {
        dailyWindow: d.dailyWindow,
        label: d.dailyWindow.slice(5),
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
    return {
      maxDaily: Math.max(...dailyWindows.map((d) => dailyWindowMetricTotal(d, metric)), 0),
      total: dailyWindows.reduce((sum, d) => sum + dailyWindowMetricTotal(d, metric), 0),
    };
  }, [scaleEvents, ctx, metric]);

  const handleClick = (payload: { dailyWindow?: string } | undefined) => {
    if (payload?.dailyWindow) onSelectDailyWindow?.(payload.dailyWindow);
  };

  const title = metric === "cost" ? "日別コスト推移" : "日別トークン推移";

  return (
    <div className="panel wide">
      <h3>
        {title}(モデル分類別積み上げ + 累積)
        {showControls && onSelectDailyWindow && (
          <span className="hint">バーをクリックで詳細へ</span>
        )}
      </h3>
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={data}>
          <CartesianGrid stroke="#21262d" vertical={false} />
          <XAxis dataKey="label" stroke="#8b949e" fontSize={12} />
          <YAxis
            yAxisId="primary"
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
            contentStyle={tooltipStyle}
            itemStyle={tooltipTextStyle}
            labelStyle={tooltipTextStyle}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {families.map((family, i) => (
            <Bar
              key={family}
              yAxisId="primary"
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
 * unselected users together. Ranking, bars, pies, tables, and summaries
 * follow the selected Metric.
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
  const eventTitle = metric === "tokens" ? "高トークンイベント Top 20" : "高コストイベント Top 20";
  return (
    <>
      <OverviewSummary events={events} ctx={ctx} metric={metric} />
      <div className="grid">
        <DailyChart
          events={events}
          scaleEvents={userEvents}
          ctx={ctx}
          familyColors={familyColors}
          metric={metric}
          showControls={showControls}
          onSelectDailyWindow={onSelectDailyWindow}
        />
        <ModelFamilyPanel
          events={events}
          familyColors={familyColors}
          metric={metric}
          showControls={showControls}
        />
        <UserChart
          events={userEvents}
          selectedUser={selectedUser}
          metric={metric}
          showControls={showControls}
          onSelectUser={onSelectUser}
        />
        <EventsTable
          events={top}
          timeZone={ctx.timeZone}
          title={eventTitle}
          timeHeader={`日時 (${ctx.timeZone})`}
          formatTimestamp={formatDateTime}
        />
      </div>
    </>
  );
}
