import type { UsageEvent } from "../../src/core/types.ts";

import { useMemo } from "react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  byDailyWindow,
  byHour,
  byKind,
  byModel,
  byUser,
  eventsInDailyWindow,
  orderedHours,
  summarize,
} from "../../src/core/aggregate.ts";
import { COLORS, BAR_SIZE, formatTime, formatTokens, formatUsd, tooltipStyle } from "./shared.ts";

interface Props {
  events: UsageEvent[];
  userEvents: UsageEvent[];
  dailyWindow: string;
  timeZone: string;
  startHour: number;
  eventLimit?: number;
  showControls: boolean;
  selectedUser: string | null;
  onBack: () => void;
  onSelectDailyWindow: (dailyWindow: string) => void;
  onSelectUser: (user: string) => void;
}

function DailyWindowSummaryCards({
  dailyWindowEvents,
  timeZone,
  startHour,
  totalCost,
  rank,
  dailyWindowCount,
}: {
  dailyWindowEvents: UsageEvent[];
  timeZone: string;
  startHour: number;
  totalCost: number;
  rank: number;
  dailyWindowCount: number;
}) {
  const s = useMemo(
    () => summarize(dailyWindowEvents, timeZone, startHour),
    [dailyWindowEvents, timeZone, startHour],
  );
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
  timeZone,
  startHour,
}: {
  dailyWindowEvents: UsageEvent[];
  scaleDayEvents: UsageEvent[];
  timeZone: string;
  startHour: number;
}) {
  const data = useMemo(() => {
    const byHourMap = new Map(byHour(dailyWindowEvents, timeZone).map((b) => [b.key, b]));
    return orderedHours(startHour).map((key) => {
      const b = byHourMap.get(key);
      return {
        hour: key,
        cost: b?.cost ?? 0,
        eventCount: b?.eventCount ?? 0,
      };
    });
  }, [dailyWindowEvents, timeZone, startHour]);
  const maxHourlyCost = useMemo(
    () => Math.max(...byHour(scaleDayEvents, timeZone).map((b) => b.cost), 0),
    [scaleDayEvents, timeZone],
  );

  return (
    <div className="panel wide">
      <h3>時間帯別コスト ({timeZone})</h3>
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
            labelFormatter={(h) => `${h}:00 ${timeZone}`}
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

function ModelPie({ dailyWindowEvents }: { dailyWindowEvents: UsageEvent[] }) {
  const data = useMemo(() => byModel(dailyWindowEvents), [dailyWindowEvents]);
  return (
    <div className="panel">
      <h3>モデル別コスト</h3>
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie
            data={data}
            dataKey="cost"
            nameKey="key"
            innerRadius={50}
            outerRadius={90}
            paddingAngle={2}
            stroke="none"
            isAnimationActive={false}
          >
            {data.map((entry, i) => (
              <Cell key={entry.key} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatUsd(Number(value))} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
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
                  <span className="badge">{e.model}</span>
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
  timeZone,
  startHour,
  eventLimit,
  showControls,
  selectedUser,
  onBack,
  onSelectDailyWindow,
  onSelectUser,
}: Props) {
  const dailyWindows = useMemo(
    () => byDailyWindow(events, timeZone, startHour).map((d) => d.key),
    [events, timeZone, startHour],
  );
  const dailyWindowEvents = useMemo(
    () => eventsInDailyWindow(events, dailyWindow, timeZone, startHour),
    [events, dailyWindow, timeZone, startHour],
  );
  const dailyWindowUserEvents = useMemo(
    () => eventsInDailyWindow(userEvents, dailyWindow, timeZone, startHour),
    [userEvents, dailyWindow, timeZone, startHour],
  );
  const totalCost = useMemo(() => events.reduce((sum, e) => sum + e.cost, 0), [events]);
  const costRank = useMemo(() => {
    const sorted = byDailyWindow(events, timeZone, startHour).sort((a, b) => b.cost - a.cost);
    return sorted.findIndex((d) => d.key === dailyWindow) + 1;
  }, [events, dailyWindow, timeZone, startHour]);

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
            {dailyWindowEvents.length} 課金イベント ({timeZone}, start {startHour}:00)
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
            timeZone={timeZone}
            startHour={startHour}
            totalCost={totalCost}
            rank={costRank}
            dailyWindowCount={dailyWindows.length}
          />
          <div className="grid">
            <HourlyChart
              dailyWindowEvents={dailyWindowEvents}
              scaleDayEvents={dailyWindowUserEvents}
              timeZone={timeZone}
              startHour={startHour}
            />
            <ModelPie dailyWindowEvents={dailyWindowEvents} />
            <UserChart
              dailyWindowEvents={dailyWindowUserEvents}
              selectedUser={selectedUser}
              showControls={showControls}
              onSelectUser={onSelectUser}
            />
            <KindBreakdown dailyWindowEvents={dailyWindowEvents} />
            <DailyWindowEventsTable
              dailyWindowEvents={dailyWindowEvents}
              timeZone={timeZone}
              eventLimit={eventLimit}
            />
          </div>
        </>
      )}
    </div>
  );
}
