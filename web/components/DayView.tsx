import type { AnalysisContext, UsageEvent } from "../../src/core/types.ts";

import { useMemo } from "react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { byDailyWindow, byHour, byKind, byUser, summarize } from "../../src/core/aggregate.ts";
import { formatTime, formatTokens, formatUsd } from "../../src/core/format.ts";
import { eventsInDailyWindow, orderedHours } from "../../src/core/time.ts";
import { ModelCell } from "./ModelCell.tsx";
import { ModelFamilyPanel } from "./ModelFamilyPanel.tsx";
import { BAR_SIZE, modelFamilyColors, tooltipStyle } from "./shared.ts";

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
  ctx,
  totalCost,
  rank,
  dailyWindowCount,
}: {
  dailyWindowEvents: UsageEvent[];
  ctx: AnalysisContext;
  totalCost: number;
  rank: number;
  dailyWindowCount: number;
}) {
  const s = useMemo(() => summarize(dailyWindowEvents, ctx), [dailyWindowEvents, ctx]);
  const share = totalCost > 0 ? Math.round((s.totalCost / totalCost) * 100) : 0;
  const cards = [
    { label: "Cost", value: formatUsd(s.totalCost), sub: `期間全体の ${share}%` },
    {
      label: "Events",
      value: String(s.eventCount),
      sub: `Max Mode ${Math.round(s.maxModeRatio * 100)}%`,
    },
    { label: "Tokens", value: formatTokens(s.totalTokens), sub: "this window" },
    { label: "Users / Models", value: `${s.userCount} / ${s.modelCount}`, sub: "active window" },
    { label: "コスト順位", value: `${rank} / ${dailyWindowCount}`, sub: "Daily Windowランキング" },
  ];
  return (
    <div className="cards">
      {cards.map((c) => (
        <div className="card" key={c.label}>
          <div className="label">{c.label}</div>
          <div className="value">{c.value}</div>
          <div className="sub">{c.sub}</div>
        </div>
      ))}
    </div>
  );
}

function HourlyChart({
  dailyWindowEvents,
  scaleDayEvents,
  ctx,
}: {
  dailyWindowEvents: UsageEvent[];
  scaleDayEvents: UsageEvent[];
  ctx: AnalysisContext;
}) {
  const data = useMemo(() => {
    const byHourMap = new Map(byHour(dailyWindowEvents, ctx).map((b) => [b.key, b]));
    return orderedHours(ctx).map((key) => {
      const b = byHourMap.get(key);
      return {
        hour: key,
        cost: b?.cost ?? 0,
        eventCount: b?.eventCount ?? 0,
      };
    });
  }, [dailyWindowEvents, ctx]);
  const maxHourlyCost = useMemo(
    () => Math.max(...byHour(scaleDayEvents, ctx).map((b) => b.cost), 0),
    [scaleDayEvents, ctx],
  );

  return (
    <div className="panel wide">
      <h3>時間帯別コスト ({ctx.timeZone})</h3>
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={data}>
          <CartesianGrid stroke="#21262d" vertical={false} />
          <XAxis dataKey="hour" stroke="#8b949e" fontSize={12} />
          <YAxis
            domain={[0, maxHourlyCost]}
            stroke="#8b949e"
            fontSize={12}
            tickFormatter={(value) => formatUsd(Number(value), { trimZeroCents: true })}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value) => [formatUsd(Number(value)), "Cost"]}
            labelFormatter={(h) => `${h}:00 ${ctx.timeZone}`}
          />
          <Bar
            dataKey="cost"
            name="Cost"
            fill="#58a6ff"
            radius={[4, 4, 0, 0]}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function UserChart({
  dailyWindowEvents,
  selectedUser,
  showControls,
  onSelectUser,
}: {
  dailyWindowEvents: UsageEvent[];
  selectedUser: string | null;
  showControls: boolean;
  onSelectUser: (user: string) => void;
}) {
  const data = useMemo(() => byUser(dailyWindowEvents).slice(0, 10), [dailyWindowEvents]);
  const isSelected = (user: string) => !selectedUser || selectedUser === user;
  return (
    <div className="panel">
      <h3>
        ユーザー別コスト (Top 10)
        {showControls && <span className="hint">バーをクリックでユーザー選択/解除</span>}
      </h3>
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={data} layout="vertical">
          <CartesianGrid stroke="#21262d" horizontal={false} />
          <XAxis
            type="number"
            stroke="#8b949e"
            fontSize={12}
            tickFormatter={(value) => formatUsd(Number(value), { trimZeroCents: true })}
          />
          <YAxis type="category" dataKey="key" stroke="#8b949e" fontSize={12} width={160} />
          <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatUsd(Number(value))} />
          <Bar
            dataKey="cost"
            name="Cost"
            radius={[0, 4, 4, 0]}
            cursor={showControls ? "pointer" : undefined}
            onClick={(payload) => {
              if (!showControls) return;
              const user = (payload as { key?: string } | undefined)?.key;
              if (user) onSelectUser(user);
            }}
            isAnimationActive={false}
            barSize={BAR_SIZE}
            maxBarSize={BAR_SIZE}
          >
            {data.map((entry) => (
              <Cell key={entry.key} fill="#3fb950" opacity={isSelected(entry.key) ? 1 : 0.25} />
            ))}
          </Bar>
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
              <th className="num">Cost</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.key}>
                <td>{d.key}</td>
                <td className="num">{d.eventCount}</td>
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

function DailyWindowEventsTable({
  dailyWindowEvents,
  timeZone,
  eventLimit,
}: {
  dailyWindowEvents: UsageEvent[];
  timeZone: string;
  eventLimit?: number;
}) {
  const rows = useMemo(() => {
    const sorted = [...dailyWindowEvents].sort((a, b) => b.cost - a.cost);
    return eventLimit === undefined ? sorted : sorted.slice(0, eventLimit);
  }, [dailyWindowEvents, eventLimit]);
  const title =
    eventLimit === undefined
      ? `この Daily Window のイベント (${rows.length}件・コスト降順)`
      : `この Daily Window のイベント Top ${eventLimit} (${rows.length} of ${dailyWindowEvents.length}件・コスト降順)`;
  return (
    <div className="panel wide">
      <h3>{title}</h3>
      <div className="table-wrap scroll">
        <table>
          <thead>
            <tr>
              <th>時刻 ({timeZone})</th>
              <th>ユーザー</th>
              <th>モデル</th>
              <th>種別</th>
              <th className="num">Input</th>
              <th className="num">Cache Read</th>
              <th className="num">Output</th>
              <th className="num">Total</th>
              <th className="num">Cost</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr
                key={[e.date.toISOString(), e.user, e.model, e.kind, e.totalTokens, e.cost].join(
                  "|",
                )}
              >
                <td>{formatTime(e.date, timeZone)}</td>
                <td>{e.user}</td>
                <td>
                  <ModelCell event={e} />
                </td>
                <td>{e.kind}</td>
                <td className="num">
                  {formatTokens(e.inputWithCacheWrite + e.inputWithoutCacheWrite)}
                </td>
                <td className="num">{formatTokens(e.cacheRead)}</td>
                <td className="num">{formatTokens(e.outputTokens)}</td>
                <td className="num">{formatTokens(e.totalTokens)}</td>
                <td className="num">{formatUsd(e.cost)}</td>
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
  const costRank = useMemo(() => {
    const sorted = byDailyWindow(events, ctx).sort((a, b) => b.cost - a.cost);
    return sorted.findIndex((d) => d.key === dailyWindow) + 1;
  }, [events, dailyWindow, ctx]);

  const familyColors = useMemo(() => modelFamilyColors(userEvents), [userEvents]);
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
            rank={costRank}
            dailyWindowCount={dailyWindows.length}
          />
          <div className="grid">
            <HourlyChart
              dailyWindowEvents={dailyWindowEvents}
              scaleDayEvents={dailyWindowUserEvents}
              ctx={ctx}
            />
            <ModelFamilyPanel
              events={dailyWindowEvents}
              familyColors={familyColors}
              showControls={showControls}
              height={260}
            />
            <UserChart
              dailyWindowEvents={dailyWindowUserEvents}
              selectedUser={selectedUser}
              showControls={showControls}
              onSelectUser={onSelectUser}
            />
            <KindBreakdown dailyWindowEvents={dailyWindowEvents} />
            <DailyWindowEventsTable
              dailyWindowEvents={dailyWindowEvents}
              timeZone={ctx.timeZone}
              eventLimit={eventLimit}
            />
          </div>
        </>
      )}
    </div>
  );
}
