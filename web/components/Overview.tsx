import type { AnalysisContext, UsageEvent } from "../../src/core/types.ts";

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
  summarize,
  topEvents,
} from "../../src/core/aggregate.ts";
import { formatDateTime, formatTokens, formatUsd } from "../../src/core/format.ts";
import { EventsTable } from "./EventsTable.tsx";
import { ModelFamilyPanel } from "./ModelFamilyPanel.tsx";
import { BAR_SIZE, COLORS, modelFamilyColors, tooltipStyle } from "./shared.ts";
import { SummaryCards } from "./SummaryCards.tsx";
import { UserChart } from "./UserChart.tsx";

export { formatTokens, formatUsd };

const CUMULATIVE_KEY = "cumulative";

/**
 * Daily cost tooltip: model breakdown → daily total → cumulative.
 * Order follows aggregation granularity (fine → coarse).
 */
function DailyCostTooltip(props: TooltipContentProps) {
  const { active, payload } = props;
  if (!active || !payload?.length) return null;

  const modelItems = payload.filter((item) => item.dataKey !== CUMULATIVE_KEY);
  const cumulativeItem = payload.find((item) => item.dataKey === CUMULATIVE_KEY);
  const row = payload[0]?.payload as { total?: number } | undefined;
  const total =
    typeof row?.total === "number"
      ? row.total
      : modelItems.reduce((sum, item) => sum + Number(item.value ?? 0), 0);

  const template = modelItems[0] ?? cumulativeItem;
  if (!template) return null;

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
    ...(cumulativeItem ? [cumulativeItem] : []),
  ];

  return (
    <DefaultTooltipContent
      {...props}
      payload={orderedPayload}
      formatter={(value) => formatUsd(Number(value))}
      itemSorter={undefined}
    />
  );
}

function OverviewSummary({ events, ctx }: { events: UsageEvent[]; ctx: AnalysisContext }) {
  const s = useMemo(() => summarize(events, ctx), [events, ctx]);
  return (
    <SummaryCards
      cards={[
        {
          label: "Total Cost",
          value: formatUsd(s.totalCost),
          sub: `${s.firstDailyWindow} – ${s.lastDailyWindow}`,
        },
        {
          label: "Avg Cost / Active Daily Window",
          value: formatUsd(s.avgCostPerActiveDailyWindow),
          sub: `${s.dailyWindowCount} active windows`,
        },
        {
          label: "Total Tokens",
          value: formatTokens(s.totalTokens),
          sub: `${s.eventCount} events`,
        },
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
  showControls,
  onSelectDailyWindow,
}: {
  events: UsageEvent[];
  scaleEvents: UsageEvent[];
  ctx: AnalysisContext;
  familyColors: Map<string, string>;
  showControls: boolean;
  onSelectDailyWindow?: (dailyWindow: string) => void;
}) {
  const families = useMemo(() => byModelFamily(events).map((f) => f.key), [events]);
  const data = useMemo(() => {
    let cumulative = 0;
    return byDailyWindowAndModelFamily(events, ctx).map((d) => {
      cumulative += d.totalCost;
      return {
        dailyWindow: d.dailyWindow,
        label: d.dailyWindow.slice(5),
        ...d.costByKey,
        total: d.totalCost,
        cumulative,
      };
    });
  }, [events, ctx]);
  const scale = useMemo(() => {
    const dailyWindows = byDailyWindowAndModelFamily(scaleEvents, ctx);
    return {
      maxDailyCost: Math.max(...dailyWindows.map((d) => d.totalCost), 0),
      totalCost: dailyWindows.reduce((sum, d) => sum + d.totalCost, 0),
    };
  }, [scaleEvents, ctx]);

  const handleClick = (payload: { dailyWindow?: string } | undefined) => {
    if (payload?.dailyWindow) onSelectDailyWindow?.(payload.dailyWindow);
  };

  return (
    <div className="panel wide">
      <h3>
        日別コスト推移(モデル分類別積み上げ + 累積)
        {showControls && onSelectDailyWindow && (
          <span className="hint">バーをクリックで詳細へ</span>
        )}
      </h3>
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={data}>
          <CartesianGrid stroke="#21262d" vertical={false} />
          <XAxis dataKey="label" stroke="#8b949e" fontSize={12} />
          <YAxis
            yAxisId="cost"
            domain={[0, scale.maxDailyCost]}
            stroke="#8b949e"
            fontSize={12}
            tickFormatter={(value) => formatUsd(Number(value), { trimZeroCents: true })}
          />
          <YAxis
            yAxisId="cumulative"
            domain={[0, scale.totalCost]}
            orientation="right"
            stroke="#8b949e"
            fontSize={12}
            tickFormatter={(value) => formatUsd(Number(value), { trimZeroCents: true })}
          />
          <Tooltip content={DailyCostTooltip} contentStyle={tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {families.map((family, i) => (
            <Bar
              key={family}
              yAxisId="cost"
              dataKey={family}
              stackId="cost"
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
 * unselected users together.
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
  const top = useMemo(() => topEvents(events, 20), [events]);
  return (
    <>
      <OverviewSummary events={events} ctx={ctx} />
      <div className="grid">
        <DailyChart
          events={events}
          scaleEvents={userEvents}
          ctx={ctx}
          familyColors={familyColors}
          showControls={showControls}
          onSelectDailyWindow={onSelectDailyWindow}
        />
        <ModelFamilyPanel events={events} familyColors={familyColors} showControls={showControls} />
        <UserChart
          events={userEvents}
          selectedUser={selectedUser}
          showControls={showControls}
          onSelectUser={onSelectUser}
        />
        <EventsTable
          events={top}
          timeZone={ctx.timeZone}
          title="高コストイベント Top 20"
          timeHeader={`日時 (${ctx.timeZone})`}
          formatTimestamp={formatDateTime}
        />
      </div>
    </>
  );
}
