import type { UsageEvent } from "../../src/core/types.ts";

import { useMemo } from "react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  byDailyWindowAndModel,
  byModel,
  byUser,
  summarize,
  topEvents,
} from "../../src/core/aggregate.ts";
import {
  COLORS,
  BAR_SIZE,
  formatDateTime,
  formatTokens,
  formatUsd,
  tooltipStyle,
} from "./shared.ts";

export { formatTokens, formatUsd };

function SummaryCards({
  events,
  timeZone,
  startHour,
}: {
  events: UsageEvent[];
  timeZone: string;
  startHour: number;
}) {
  const s = useMemo(() => summarize(events, timeZone, startHour), [events, timeZone, startHour]);
  const cards = [
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
    { label: "Total Tokens", value: formatTokens(s.totalTokens), sub: `${s.eventCount} events` },
    { label: "Max Mode", value: `${Math.round(s.maxModeRatio * 100)}%`, sub: "of events" },
    { label: "Users / Models", value: `${s.userCount} / ${s.modelCount}`, sub: "in this export" },
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

function DailyChart({
  events,
  scaleEvents,
  timeZone,
  startHour,
  showControls,
  onSelectDailyWindow,
}: {
  events: UsageEvent[];
  scaleEvents: UsageEvent[];
  timeZone: string;
  startHour: number;
  showControls: boolean;
  onSelectDailyWindow?: (dailyWindow: string) => void;
}) {
  const models = useMemo(() => byModel(events).map((m) => m.key), [events]);
  const data = useMemo(() => {
    let cumulative = 0;
    return byDailyWindowAndModel(events, timeZone, startHour).map((d) => {
      cumulative += d.totalCost;
      return {
        dailyWindow: d.dailyWindow,
        label: d.dailyWindow.slice(5),
        ...d.costByModel,
        cumulative,
      };
    });
  }, [events, timeZone, startHour]);
  const scale = useMemo(() => {
    const dailyWindows = byDailyWindowAndModel(scaleEvents, timeZone, startHour);
    return {
      maxDailyCost: Math.max(...dailyWindows.map((d) => d.totalCost), 0),
      totalCost: dailyWindows.reduce((sum, d) => sum + d.totalCost, 0),
    };
  }, [scaleEvents, timeZone, startHour]);

  const handleClick = (payload: { dailyWindow?: string } | undefined) => {
    if (payload?.dailyWindow) onSelectDailyWindow?.(payload.dailyWindow);
  };

  return (
    <div className="panel wide">
      <h3>
        日別コスト推移(モデル別積み上げ + 累積)
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
          <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatUsd(Number(value))} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {models.map((model, i) => (
            <Bar
              key={model}
              yAxisId="cost"
              dataKey={model}
              stackId="cost"
              fill={COLORS[i % COLORS.length]}
              cursor={showControls && onSelectDailyWindow ? "pointer" : undefined}
              onClick={(payload) => handleClick(payload as { dailyWindow?: string } | undefined)}
              isAnimationActive={false}
              barSize={BAR_SIZE}
              maxBarSize={BAR_SIZE}
            />
          ))}
          <Line
            yAxisId="cumulative"
            dataKey="cumulative"
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

function ModelPie({ events }: { events: UsageEvent[] }) {
  const data = useMemo(() => byModel(events), [events]);
  return (
    <div className="panel">
      <h3>モデル別コスト</h3>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={data}
            dataKey="cost"
            nameKey="key"
            innerRadius={55}
            outerRadius={95}
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
  events,
  selectedUser,
  showControls,
  onSelectUser,
}: {
  events: UsageEvent[];
  selectedUser: string | null;
  showControls: boolean;
  onSelectUser?: (user: string) => void;
}) {
  const data = useMemo(() => byUser(events).slice(0, 10), [events]);
  const isSelected = (user: string) => !selectedUser || selectedUser === user;
  return (
    <div className="panel">
      <h3>
        ユーザー別コスト (Top 10)
        {showControls && onSelectUser && (
          <span className="hint">バーをクリックでユーザー選択/解除</span>
        )}
      </h3>
      <ResponsiveContainer width="100%" height={280}>
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
            cursor={showControls && onSelectUser ? "pointer" : undefined}
            onClick={(payload) => {
              if (!showControls) return;
              const user = (payload as { key?: string } | undefined)?.key;
              if (user) onSelectUser?.(user);
            }}
            isAnimationActive={false}
            barSize={BAR_SIZE}
            maxBarSize={BAR_SIZE}
          >
            {data.map((entry) => (
              <Cell key={entry.key} fill="#58a6ff" opacity={isSelected(entry.key) ? 1 : 0.25} />
            ))}
          </Bar>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function TopEventsTable({ events, timeZone }: { events: UsageEvent[]; timeZone: string }) {
  const top = useMemo(() => topEvents(events, 20), [events]);
  return (
    <div className="panel wide">
      <h3>高コストイベント Top 20</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>日時 ({timeZone})</th>
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
            {top.map((e) => (
              <tr
                key={[e.date.toISOString(), e.user, e.model, e.kind, e.totalTokens, e.cost].join(
                  "|",
                )}
              >
                <td>{formatDateTime(e.date, timeZone)}</td>
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
 * Shows the top-level analysis for the loaded Usage Export.
 *
 * `events` is the currently filtered analysis set. `userEvents` keeps the
 * unfiltered User comparison set so the User chart can show selected and
 * unselected users together.
 */
export function Overview({
  events,
  userEvents,
  timeZone,
  startHour,
  showControls,
  onSelectDailyWindow,
  onSelectUser,
  selectedUser,
}: {
  events: UsageEvent[];
  userEvents: UsageEvent[];
  timeZone: string;
  startHour: number;
  showControls: boolean;
  onSelectDailyWindow?: (dailyWindow: string) => void;
  onSelectUser?: (user: string) => void;
  selectedUser: string | null;
}) {
  return (
    <>
      <SummaryCards events={events} timeZone={timeZone} startHour={startHour} />
      <div className="grid">
        <DailyChart
          events={events}
          scaleEvents={userEvents}
          timeZone={timeZone}
          startHour={startHour}
          showControls={showControls}
          onSelectDailyWindow={onSelectDailyWindow}
        />
        <ModelPie events={events} />
        <UserChart
          events={userEvents}
          selectedUser={selectedUser}
          showControls={showControls}
          onSelectUser={onSelectUser}
        />
        <TopEventsTable events={events} timeZone={timeZone} />
      </div>
    </>
  );
}
