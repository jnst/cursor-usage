import type { AnalysisContext, Metric, UsageEvent } from "../../src/core/types.ts";

import { useMemo } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  bucketMetric,
  byDailyWindow,
  byHour,
  byKind,
  summarize,
} from "../../src/core/aggregate.ts";
import {
  formatMetric,
  formatTime,
  formatTokens,
  formatUsd,
  formatUsdPerMTok,
} from "../../src/core/format.ts";
import { eventsInDailyWindow, orderedHours } from "../../src/core/time.ts";
import { EventsTable } from "./EventsTable.tsx";
import { ModelFamilyPanel } from "./ModelFamilyPanel.tsx";
import { metricLabel, modelFamilyColors, tooltipItemStyle, tooltipStyle } from "./shared.ts";
import { SummaryCards } from "./SummaryCards.tsx";
import { UserChart } from "./UserChart.tsx";

interface Props {
  events: UsageEvent[];
  userEvents: UsageEvent[];
  dailyWindow: string;
  ctx: AnalysisContext;
  metric: Metric;
  eventLimit?: number;
  showControls: boolean;
  selectedUser: string | null;
  onBack: () => void;
  onSelectDailyWindow: (dailyWindow: string) => void;
  onSelectUser: (user: string) => void;
}

function DailyWindowSummaryCards({
  dailyWindowEvents,
  ctx,
  metric,
  periodTotal,
  rank,
  dailyWindowCount,
}: {
  dailyWindowEvents: UsageEvent[];
  ctx: AnalysisContext;
  metric: Metric;
  periodTotal: number;
  rank: number;
  dailyWindowCount: number;
}) {
  const s = useMemo(() => summarize(dailyWindowEvents, ctx), [dailyWindowEvents, ctx]);
  const windowValue = metric === "tokens" ? s.totalTokens : s.totalCost;
  const share = periodTotal > 0 ? Math.round((windowValue / periodTotal) * 100) : 0;
  const cards = [
    {
      label: metric === "tokens" ? "Tokens" : "Cost",
      value: formatMetric(windowValue, metric),
      sub: `期間全体の ${share}%`,
    },
    {
      label: metric === "tokens" ? "Cost" : "Tokens",
      value: metric === "tokens" ? formatUsd(s.totalCost) : formatTokens(s.totalTokens),
      sub: "this window",
    },
    {
      label: "Effective Rate",
      value: formatUsdPerMTok(s.totalCost, s.totalTokens),
      sub: "$ / MTok",
    },
    {
      label: "Events",
      value: String(s.eventCount),
      sub: `${s.userCount} users / ${s.modelCount} models`,
    },
    {
      label: `${metricLabel(metric)}順位`,
      value: `${rank} / ${dailyWindowCount}`,
      sub: "Daily Windowランキング",
    },
  ];
  return <SummaryCards cards={cards} />;
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
  const data = useMemo(() => {
    const byHourMap = new Map(byHour(dailyWindowEvents, ctx).map((b) => [b.key, b]));
    return orderedHours(ctx).map((key) => {
      const b = byHourMap.get(key);
      return {
        hour: key,
        value: b ? bucketMetric(b, metric) : 0,
        eventCount: b?.eventCount ?? 0,
      };
    });
  }, [dailyWindowEvents, ctx, metric]);
  const maxHourly = useMemo(
    () => Math.max(...byHour(scaleDayEvents, ctx).map((b) => bucketMetric(b, metric)), 0),
    [scaleDayEvents, ctx, metric],
  );
  const label = metricLabel(metric);

  return (
    <div className="panel wide">
      <h3>
        時間帯別{metric === "tokens" ? "トークン" : "コスト"} ({ctx.timeZone})
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
            contentStyle={tooltipStyle}
            itemStyle={tooltipItemStyle}
            labelStyle={tooltipItemStyle}
            formatter={(value) => [formatMetric(Number(value), metric), label]}
            labelFormatter={(h) => `${h}:00 ${ctx.timeZone}`}
          />
          <Bar
            dataKey="value"
            name={label}
            fill="#58a6ff"
            radius={[4, 4, 0, 0]}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function KindBreakdown({
  dailyWindowEvents,
  metric,
}: {
  dailyWindowEvents: UsageEvent[];
  metric: Metric;
}) {
  const data = useMemo(() => byKind(dailyWindowEvents, metric), [dailyWindowEvents, metric]);
  const maxValue = Math.max(...data.map((d) => bucketMetric(d, metric)), 0);
  const label = metricLabel(metric);
  return (
    <div className="panel">
      <h3>種別別内訳</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>種別</th>
              <th className="num">イベント</th>
              <th className="num">{label}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => {
              const value = bucketMetric(d, metric);
              return (
                <tr key={d.key}>
                  <td>{d.key}</td>
                  <td className="num">{d.eventCount}</td>
                  <td className="num">
                    <span
                      className="cost-bar"
                      style={{
                        width: maxValue > 0 ? `${(value / maxValue) * 100}%` : 0,
                      }}
                    />
                    {formatMetric(value, metric)}
                  </td>
                </tr>
              );
            })}
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
 * selected user can be shown without hiding the other users. Rankings follow
 * the Selected Metric.
 */
export function DailyWindowView({
  events,
  userEvents,
  dailyWindow,
  ctx,
  metric,
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
  const periodTotal = useMemo(() => {
    const s = summarize(events, ctx);
    return metric === "tokens" ? s.totalTokens : s.totalCost;
  }, [events, ctx, metric]);
  const rank = useMemo(() => {
    const sorted = [...byDailyWindow(events, ctx)].sort(
      (a, b) => bucketMetric(b, metric) - bucketMetric(a, metric),
    );
    return sorted.findIndex((d) => d.key === dailyWindow) + 1;
  }, [events, dailyWindow, ctx, metric]);

  const familyColors = useMemo(() => modelFamilyColors(userEvents), [userEvents]);
  const eventRows = useMemo(() => {
    const sorted = [...dailyWindowEvents].sort((a, b) =>
      metric === "tokens" ? b.totalTokens - a.totalTokens : b.cost - a.cost,
    );
    return eventLimit === undefined ? sorted : sorted.slice(0, eventLimit);
  }, [dailyWindowEvents, eventLimit, metric]);
  const orderLabel = metric === "tokens" ? "トークン降順" : "コスト降順";
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
          <DailyWindowSummaryCards
            dailyWindowEvents={dailyWindowEvents}
            ctx={ctx}
            metric={metric}
            periodTotal={periodTotal}
            rank={rank}
            dailyWindowCount={dailyWindows.length}
          />
          <div className="grid">
            <HourlyChart
              dailyWindowEvents={dailyWindowEvents}
              scaleDayEvents={dailyWindowUserEvents}
              ctx={ctx}
              metric={metric}
            />
            <ModelFamilyPanel
              events={dailyWindowEvents}
              metric={metric}
              familyColors={familyColors}
              showControls={showControls}
              height={260}
            />
            <UserChart
              events={dailyWindowUserEvents}
              metric={metric}
              selectedUser={selectedUser}
              showControls={showControls}
              onSelectUser={onSelectUser}
              height={260}
              barFill="#3fb950"
            />
            <KindBreakdown dailyWindowEvents={dailyWindowEvents} metric={metric} />
            <EventsTable
              events={eventRows}
              timeZone={ctx.timeZone}
              title={eventTitle}
              timeHeader={`時刻 (${ctx.timeZone})`}
              formatTimestamp={formatTime}
              wrapClassName="table-wrap scroll"
            />
          </div>
        </>
      )}
    </div>
  );
}
