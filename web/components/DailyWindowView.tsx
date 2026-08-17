import type { AnalysisContext, DisplayMetric, UsageEvent } from "../../src/core/types.ts";

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

import { byDailyWindow, byHour, byKind, summarize } from "../../src/core/aggregate.ts";
import {
  formatMetric,
  formatTime,
  formatTokens,
  formatUsd,
  formatUsdPerMTok,
} from "../../src/core/format.ts";
import { eventsInDailyWindow, orderedHours } from "../../src/core/time.ts";
import { EventsTable } from "./EventsTable.tsx";
import { MetricToggle } from "./MetricToggle.tsx";
import { ModelFamilyPanel } from "./ModelFamilyPanel.tsx";
import { modelFamilyColors, tooltipStyle } from "./shared.ts";
import { SummaryCards } from "./SummaryCards.tsx";
import { UserChart } from "./UserChart.tsx";

interface Props {
  events: UsageEvent[];
  userEvents: UsageEvent[];
  dailyWindow: string;
  ctx: AnalysisContext;
  metric: DisplayMetric;
  onMetricChange?: (metric: DisplayMetric) => void;
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
  totalCost,
  costRank,
  tokenRank,
  dailyWindowCount,
}: {
  dailyWindowEvents: UsageEvent[];
  ctx: AnalysisContext;
  totalCost: number;
  costRank: number;
  tokenRank: number;
  dailyWindowCount: number;
}) {
  const s = useMemo(() => summarize(dailyWindowEvents, ctx), [dailyWindowEvents, ctx]);
  const share = totalCost > 0 ? Math.round((s.totalCost / totalCost) * 100) : 0;
  const cards = [
    { label: "Cost", value: formatUsd(s.totalCost), sub: `期間全体の ${share}%` },
    { label: "Tokens", value: formatTokens(s.totalTokens), sub: "this window" },
    {
      label: "Effective Rate",
      value: formatUsdPerMTok(s.totalCost, s.totalTokens),
      sub: "Cost / million tokens",
    },
    {
      label: "Events",
      value: String(s.eventCount),
      sub: `Max Mode ${Math.round(s.maxModeRatio * 100)}%`,
    },
    {
      label: "順位",
      value: `${costRank} / ${dailyWindowCount}`,
      sub: `Cost · Tokens ${tokenRank} / ${dailyWindowCount}`,
    },
  ];
  return <SummaryCards cards={cards} />;
}

function HourlyChart({
  dailyWindowEvents,
  scaleDayEvents,
  ctx,
  metric,
  onMetricChange,
  showControls,
}: {
  dailyWindowEvents: UsageEvent[];
  scaleDayEvents: UsageEvent[];
  ctx: AnalysisContext;
  metric: DisplayMetric;
  onMetricChange?: (metric: DisplayMetric) => void;
  showControls: boolean;
}) {
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
  const maxHourly = useMemo(() => {
    const hours = byHour(scaleDayEvents, ctx);
    return Math.max(...hours.map((b) => (metric === "tokens" ? b.totalTokens : b.cost)), 0);
  }, [scaleDayEvents, ctx, metric]);
  const dataKey = metric === "tokens" ? "totalTokens" : "cost";

  return (
    <div className="panel wide">
      <div className="panel-header">
        <h3>
          {metric === "cost" ? "時間帯別コスト" : "時間帯別トークン"} ({ctx.timeZone})
        </h3>
        <MetricToggle metric={metric} onChange={onMetricChange} disabled={!showControls} />
      </div>
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
            formatter={(_value, _name, item) => {
              const row = item?.payload as { cost?: number; totalTokens?: number } | undefined;
              const cost = row?.cost ?? 0;
              const tokens = row?.totalTokens ?? 0;
              return [
                `${formatMetric(metric === "cost" ? cost : tokens, metric)} · ${formatUsdPerMTok(cost, tokens)}`,
                metric === "cost" ? "Cost" : "Tokens",
              ];
            }}
            labelFormatter={(h) => `${h}:00 ${ctx.timeZone}`}
          />
          <Bar
            dataKey={dataKey}
            name={metric === "cost" ? "Cost" : "Tokens"}
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
  const data = useMemo(() => byKind(dailyWindowEvents), [dailyWindowEvents]);
  const maxCost = Math.max(...data.map((d) => d.cost), 0);
  return (
    <div className="panel">
      <h3>種別別内訳</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>種別</th>
              <th className="num">イベント</th>
              <th className="num">Tokens</th>
              <th className="num">Cost</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.key}>
                <td>{d.key}</td>
                <td className="num">{d.eventCount}</td>
                <td className="num">{formatTokens(d.totalTokens)}</td>
                <td className="num">
                  <span
                    className="cost-bar"
                    style={{
                      width: maxCost > 0 ? `${(d.cost / maxCost) * 100}%` : 0,
                    }}
                  />
                  {formatUsd(d.cost)}
                </td>
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
 * selected user can be shown without hiding the other users.
 */
export function DailyWindowView({
  events,
  userEvents,
  dailyWindow,
  ctx,
  metric,
  onMetricChange,
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
  const totalCost = useMemo(() => events.reduce((sum, e) => sum + e.cost, 0), [events]);
  const ranked = useMemo(() => {
    const windows = byDailyWindow(events, ctx);
    const byCost = [...windows].sort((a, b) => b.cost - a.cost);
    const byTokens = [...windows].sort((a, b) => b.totalTokens - a.totalTokens);
    return {
      costRank: byCost.findIndex((d) => d.key === dailyWindow) + 1,
      tokenRank: byTokens.findIndex((d) => d.key === dailyWindow) + 1,
    };
  }, [events, dailyWindow, ctx]);

  const familyColors = useMemo(() => modelFamilyColors(userEvents), [userEvents]);
  const eventRows = useMemo(() => {
    const sorted = [...dailyWindowEvents].sort((a, b) => b.cost - a.cost);
    return eventLimit === undefined ? sorted : sorted.slice(0, eventLimit);
  }, [dailyWindowEvents, eventLimit]);
  const eventTitle =
    eventLimit === undefined
      ? `この Daily Window のイベント (${eventRows.length}件・コスト降順)`
      : `この Daily Window のイベント Top ${eventLimit} (${eventRows.length} of ${dailyWindowEvents.length}件・コスト降順)`;
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
            totalCost={totalCost}
            costRank={ranked.costRank}
            tokenRank={ranked.tokenRank}
            dailyWindowCount={dailyWindows.length}
          />
          <div className="grid">
            <HourlyChart
              dailyWindowEvents={dailyWindowEvents}
              scaleDayEvents={dailyWindowUserEvents}
              ctx={ctx}
              metric={metric}
              onMetricChange={onMetricChange}
              showControls={showControls}
            />
            <ModelFamilyPanel
              events={dailyWindowEvents}
              familyColors={familyColors}
              metric={metric}
              showControls={showControls}
              height={260}
            />
            <UserChart
              events={dailyWindowUserEvents}
              selectedUser={selectedUser}
              metric={metric}
              showControls={showControls}
              onSelectUser={onSelectUser}
              height={260}
              barFill="#3fb950"
            />
            <KindBreakdown dailyWindowEvents={dailyWindowEvents} />
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
