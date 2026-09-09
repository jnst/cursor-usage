import type { AnalysisContext, Metric, UsageEvent } from "../../src/core/types.ts";

import { useMemo } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  DefaultTooltipContent,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";

import {
  bucketMetric,
  byDailyWindow,
  byHour,
  byKind,
  summarize,
} from "../../src/core/aggregate.ts";
import { formatTime, formatTokens, formatUsdPerMTok } from "../../src/core/format.ts";
import { eventsInDailyWindow, orderedHours } from "../../src/core/time.ts";
import { CloudAgentAnalysis } from "./CloudAgentAnalysis.tsx";
import { useCostVisibility } from "./CostVisibility.tsx";
import { EventsTable } from "./EventsTable.tsx";
import { ModelFamilyPanel } from "./ModelFamilyPanel.tsx";
import {
  EFFECTIVE_RATE_HOVER_LABEL,
  metricHoverLabel,
  metricLabel,
  modelFamilyColors,
  tooltipItemStyle,
  tooltipStyle,
} from "./shared.ts";
import { SummaryCards } from "./SummaryCards.tsx";
import { UserRankings } from "./UserRankings.tsx";

interface Props {
  events: UsageEvent[];
  userEvents: UsageEvent[];
  dailyWindow: string;
  ctx: AnalysisContext;
  eventLimit?: number;
  showControls: boolean;
  selectedUser: string | null;
  onBack: () => void;
  onSelectDailyWindow: (dailyWindow: string) => void;
  onSelectUser: (user: string) => void;
}

function DailyWindowSummaryCards({
  dailyWindowEvents,
  events,
  dailyWindow,
  ctx,
}: {
  dailyWindowEvents: UsageEvent[];
  events: UsageEvent[];
  dailyWindow: string;
  ctx: AnalysisContext;
}) {
  const s = summarize(dailyWindowEvents, ctx);
  const { formatCost: formatUsd } = useCostVisibility();
  const period = summarize(events, ctx);
  const windows = byDailyWindow(events, ctx);
  const rank = (metric: Metric) =>
    [...windows]
      .sort((a, b) => bucketMetric(b, metric) - bucketMetric(a, metric))
      .findIndex((row) => row.key === dailyWindow) + 1;
  const share = (value: number, total: number) =>
    total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <SummaryCards
      cards={[
        {
          label: "Spend",
          value: formatUsd(s.totalCost),
          sub: `期間全体の ${share(s.totalCost, period.totalCost)}% · 順位 ${rank("cost")} / ${windows.length}`,
        },
        {
          label: "Tokens",
          value: formatTokens(s.totalTokens),
          sub: `期間全体の ${share(s.totalTokens, period.totalTokens)}% · 順位 ${rank("tokens")} / ${windows.length}`,
        },
        {
          label: "Effective Rate",
          value: formatUsdPerMTok(s.totalCost, s.totalTokens),
          sub: "$ / MTok",
        },
        {
          label: "Events",
          value: String(s.eventCount),
          sub: `${s.modelCount} models · ${s.userCount} users`,
        },
      ]}
    />
  );
}

/**
 * Hourly tooltip: selected Metric → other Metric → 実効レート.
 */
function HourlyMetricTooltip({ metric, ...props }: TooltipContentProps & { metric: Metric }) {
  const { formatValue: formatMetric } = useCostVisibility();
  const { active, payload } = props;
  if (!active || !payload?.length) return null;

  const row = payload[0]?.payload as { cost?: number; totalTokens?: number } | undefined;
  const cost = row?.cost ?? 0;
  const tokens = row?.totalTokens ?? 0;
  const template = payload[0];
  if (!template) return null;

  const otherMetric: Metric = metric === "cost" ? "tokens" : "cost";
  const orderedPayload = [
    {
      ...template,
      dataKey: metric === "tokens" ? "totalTokens" : "cost",
      name: metricHoverLabel(metric),
      value: metric === "tokens" ? tokens : cost,
    },
    {
      ...template,
      dataKey: "other",
      name: metricHoverLabel(otherMetric),
      value: otherMetric === "tokens" ? tokens : cost,
      color: "#8b949e",
      fill: "#8b949e",
    },
    {
      ...template,
      dataKey: "rate",
      name: EFFECTIVE_RATE_HOVER_LABEL,
      value: formatUsdPerMTok(cost, tokens),
      color: "#8b949e",
      fill: "#8b949e",
    },
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

function HourlyChart({
  dailyWindowEvents,
  scaleDayEvents,
  ctx,
  metric,
}: {
  dailyWindowEvents: UsageEvent[];
  scaleDayEvents: UsageEvent[];
  ctx: AnalysisContext;
  metric: Metric;
}) {
  const { formatAxisValue: formatMetric } = useCostVisibility();
  const data = useMemo(() => {
    const byHourMap = new Map(byHour(dailyWindowEvents, ctx).map((b) => [b.key, b]));
    return orderedHours(ctx).map((key) => {
      const b = byHourMap.get(key);
      return {
        hour: key,
        cost: b?.cost ?? 0,
        totalTokens: b?.totalTokens ?? 0,
        eventCount: b?.eventCount ?? 0,
      };
    });
  }, [dailyWindowEvents, ctx]);
  const maxHourly = useMemo(
    () => Math.max(...byHour(scaleDayEvents, ctx).map((b) => bucketMetric(b, metric)), 0),
    [scaleDayEvents, ctx, metric],
  );
  const dataKey = metric === "tokens" ? "totalTokens" : "cost";
  const name = metricLabel(metric);

  return (
    <div className="panel wide">
      <h3>
        時間帯別{metric === "tokens" ? "Tokens" : "Spend"} ({ctx.timeZone})
      </h3>
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={data}>
          <CartesianGrid stroke="#21262d" vertical={false} />
          <XAxis dataKey="hour" stroke="#8b949e" fontSize={12} />
          <YAxis
            domain={[0, maxHourly]}
            stroke="#8b949e"
            fontSize={12}
            tickFormatter={(value) => formatMetric(Number(value), metric, { trimZeroCents: true })}
          />
          <Tooltip
            content={(props) => <HourlyMetricTooltip {...props} metric={metric} />}
            contentStyle={tooltipStyle}
            itemStyle={tooltipItemStyle}
            labelStyle={tooltipItemStyle}
            labelFormatter={(h) => `${h}:00 ${ctx.timeZone}`}
          />
          <Bar
            dataKey={dataKey}
            name={name}
            fill="#58a6ff"
            radius={[4, 4, 0, 0]}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function KindBreakdown({ dailyWindowEvents }: { dailyWindowEvents: UsageEvent[] }) {
  const { formatCost: formatUsd } = useCostVisibility();
  const data = byKind(dailyWindowEvents);
  return (
    <div className="panel wide">
      <h3>種別別内訳</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>種別</th>
              <th className="num">イベント</th>
              <th className="num">Spend</th>
              <th className="num">Tokens</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.key}>
                <td>{row.key}</td>
                <td className="num">{row.eventCount}</td>
                <td className="num">{formatUsd(row.cost)}</td>
                <td className="num">{formatTokens(row.totalTokens)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Shows analysis for one Daily Window in the selected Analysis Time Zone.
 *
 * `events` is the current filtered analysis set for charts and tables.
 * `userEvents` keeps the unfiltered User comparison set for the window so the
 * selected user can be shown without hiding the other users. Spend and Tokens are shown together.
 */
export function DailyWindowView({
  events,
  userEvents,
  dailyWindow,
  ctx,
  eventLimit,
  showControls,
  selectedUser,
  onBack,
  onSelectDailyWindow,
  onSelectUser,
}: Props) {
  const dailyWindows = useMemo(() => byDailyWindow(events, ctx).map((d) => d.key), [events, ctx]);
  const dailyWindowEvents = useMemo(
    () => eventsInDailyWindow(events, dailyWindow, ctx),
    [events, dailyWindow, ctx],
  );
  const dailyWindowUserEvents = useMemo(
    () => eventsInDailyWindow(userEvents, dailyWindow, ctx),
    [userEvents, dailyWindow, ctx],
  );
  const familyColors = useMemo(() => modelFamilyColors(userEvents), [userEvents]);
  const eventRows = useMemo(() => {
    const sorted = [...dailyWindowEvents].sort((a, b) => b.cost - a.cost);
    return eventLimit === undefined ? sorted : sorted.slice(0, eventLimit);
  }, [dailyWindowEvents, eventLimit]);
  const orderLabel = "Spend降順";
  const eventTitle =
    eventLimit === undefined
      ? `この Daily Window のイベント (${eventRows.length}件・${orderLabel})`
      : `この Daily Window のイベント Top ${eventLimit} (${eventRows.length} of ${dailyWindowEvents.length}件・${orderLabel})`;
  const idx = dailyWindows.indexOf(dailyWindow);
  const prevDailyWindow = idx > 0 ? dailyWindows[idx - 1] : undefined;
  const nextDailyWindow =
    idx >= 0 && idx < dailyWindows.length - 1 ? dailyWindows[idx + 1] : undefined;

  return (
    <div className="daily-window-view">
      <div className="daily-window-nav">
        {showControls && (
          <button type="button" className="reload-button" onClick={onBack}>
            ← 全体に戻る
          </button>
        )}
        <div className="daily-window-title">
          <h2>{dailyWindow}</h2>
          <span className="meta">
            {dailyWindowEvents.length} 課金イベント ({ctx.timeZone}, start {ctx.startHour}:00)
          </span>
        </div>
        {showControls && (
          <div className="daily-window-stepper">
            <button
              type="button"
              className="reload-button"
              disabled={!prevDailyWindow}
              onClick={() => prevDailyWindow && onSelectDailyWindow(prevDailyWindow)}
            >
              ← 前の Daily Window
            </button>
            <button
              type="button"
              className="reload-button"
              disabled={!nextDailyWindow}
              onClick={() => nextDailyWindow && onSelectDailyWindow(nextDailyWindow)}
            >
              次の Daily Window →
            </button>
          </div>
        )}
      </div>

      {dailyWindowEvents.length === 0 ? (
        <div className="panel wide">
          <p className="meta">この Daily Window の課金イベントはありません。</p>
        </div>
      ) : (
        <>
          {selectedUser && <p className="meta">選択中のユーザー: {selectedUser}</p>}
          <DailyWindowSummaryCards
            dailyWindowEvents={dailyWindowEvents}
            events={events}
            dailyWindow={dailyWindow}
            ctx={ctx}
          />
          <div className="grid">
            {(["cost", "tokens"] as const).map((metric) => (
              <HourlyChart
                key={metric}
                dailyWindowEvents={dailyWindowEvents}
                scaleDayEvents={dailyWindowUserEvents}
                ctx={ctx}
                metric={metric}
              />
            ))}
            <div className="breakdown-grid wide">
              <ModelFamilyPanel
                events={dailyWindowEvents}
                familyColors={familyColors}
                showControls={showControls}
              />
              <UserRankings
                events={dailyWindowUserEvents}
                selectedUser={selectedUser}
                showControls={showControls}
                onSelectUser={onSelectUser}
              />
            </div>
          </div>
          <div className="analysis-details">
            <div className="grid">
              <KindBreakdown dailyWindowEvents={dailyWindowEvents} />
              <CloudAgentAnalysis events={dailyWindowEvents} ctx={ctx} />
              <EventsTable
                events={eventRows}
                timeZone={ctx.timeZone}
                title={eventTitle}
                timeHeader={`時刻 (${ctx.timeZone})`}
                formatTimestamp={formatTime}
                wrapClassName="table-wrap"
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
