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
  byDay,
  byHour,
  byKind,
  byModel,
  byUser,
  onDay,
  summarize,
} from "../../src/core/aggregate.ts";
import type { UsageEvent } from "../../src/core/types.ts";
import {
  COLORS,
  formatTime,
  formatTokens,
  formatUsd,
  tooltipStyle,
} from "./shared.ts";

interface Props {
  events: UsageEvent[];
  day: string;
  timeZone: string;
  onBack: () => void;
  onSelectDay: (day: string) => void;
}

function DaySummaryCards({
  dayEvents,
  timeZone,
  totalCost,
  rank,
  dayCount,
}: {
  dayEvents: UsageEvent[];
  timeZone: string;
  totalCost: number;
  rank: number;
  dayCount: number;
}) {
  const s = useMemo(() => summarize(dayEvents, timeZone), [dayEvents, timeZone]);
  const share = totalCost > 0 ? Math.round((s.totalCost / totalCost) * 100) : 0;
  const cards = [
    { label: "Cost", value: formatUsd(s.totalCost), sub: `期間全体の ${share}%` },
    { label: "Events", value: String(s.eventCount), sub: `Max Mode ${Math.round(s.maxModeRatio * 100)}%` },
    { label: "Tokens", value: formatTokens(s.totalTokens), sub: "this day" },
    { label: "Users / Models", value: `${s.userCount} / ${s.modelCount}`, sub: "active this day" },
    { label: "コスト順位", value: `${rank} / ${dayCount}`, sub: "日別ランキング" },
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
  dayEvents,
  timeZone,
}: {
  dayEvents: UsageEvent[];
  timeZone: string;
}) {
  const data = useMemo(() => {
    const byHourMap = new Map(
      byHour(dayEvents, timeZone).map((b) => [b.key, b]),
    );
    return Array.from({ length: 24 }, (_, h) => {
      const key = String(h).padStart(2, "0");
      const b = byHourMap.get(key);
      return {
        hour: key,
        cost: b?.cost ?? 0,
        eventCount: b?.eventCount ?? 0,
      };
    });
  }, [dayEvents, timeZone]);

  return (
    <div className="panel wide">
      <h3>時間帯別コスト ({timeZone})</h3>
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={data}>
          <CartesianGrid stroke="#21262d" vertical={false} />
          <XAxis dataKey="hour" stroke="#8b949e" fontSize={12} />
          <YAxis
            stroke="#8b949e"
            fontSize={12}
            tickFormatter={(v: number) => `$${v}`}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value) => [formatUsd(Number(value)), "Cost"]}
            labelFormatter={(h) => `${h}:00 ${timeZone}`}
          />
          <Bar dataKey="cost" name="Cost" fill="#58a6ff" radius={[4, 4, 0, 0]} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function ModelPie({ dayEvents }: { dayEvents: UsageEvent[] }) {
  const data = useMemo(() => byModel(dayEvents), [dayEvents]);
  return (
    <div className="panel">
      <h3>モデル別コスト構成</h3>
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
          >
            {data.map((entry, i) => (
              <Cell key={entry.key} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value) => formatUsd(Number(value))}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function UserChart({ dayEvents }: { dayEvents: UsageEvent[] }) {
  const data = useMemo(() => byUser(dayEvents).slice(0, 10), [dayEvents]);
  return (
    <div className="panel">
      <h3>ユーザー別コスト (Top 10)</h3>
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={data} layout="vertical">
          <CartesianGrid stroke="#21262d" horizontal={false} />
          <XAxis
            type="number"
            stroke="#8b949e"
            fontSize={12}
            tickFormatter={(v: number) => `$${v}`}
          />
          <YAxis
            type="category"
            dataKey="key"
            stroke="#8b949e"
            fontSize={12}
            width={160}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value) => formatUsd(Number(value))}
          />
          <Bar dataKey="cost" name="Cost" fill="#3fb950" radius={[0, 4, 4, 0]} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function KindBreakdown({ dayEvents }: { dayEvents: UsageEvent[] }) {
  const data = useMemo(() => byKind(dayEvents), [dayEvents]);
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

function DayEventsTable({
  dayEvents,
  timeZone,
}: {
  dayEvents: UsageEvent[];
  timeZone: string;
}) {
  const rows = useMemo(
    () => [...dayEvents].sort((a, b) => b.cost - a.cost),
    [dayEvents],
  );
  return (
    <div className="panel wide">
      <h3>この日のイベント ({rows.length}件・コスト降順)</h3>
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
            {rows.map((e, i) => (
              <tr key={i}>
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

export function DayView({
  events,
  day,
  timeZone,
  onBack,
  onSelectDay,
}: Props) {
  const days = useMemo(
    () => byDay(events, timeZone).map((d) => d.key),
    [events, timeZone],
  );
  const dayEvents = useMemo(
    () => onDay(events, day, timeZone),
    [events, day, timeZone],
  );
  const totalCost = useMemo(
    () => events.reduce((sum, e) => sum + e.cost, 0),
    [events],
  );
  const costRank = useMemo(() => {
    const sorted = byDay(events, timeZone).sort((a, b) => b.cost - a.cost);
    return sorted.findIndex((d) => d.key === day) + 1;
  }, [events, day, timeZone]);

  const idx = days.indexOf(day);
  const prevDay = idx > 0 ? days[idx - 1] : undefined;
  const nextDay = idx >= 0 && idx < days.length - 1 ? days[idx + 1] : undefined;

  return (
    <div className="day-view">
      <div className="day-nav">
        <button type="button" className="reload-button" onClick={onBack}>
          ← 全体に戻る
        </button>
        <div className="day-title">
          <h2>{day}</h2>
          <span className="meta">{dayEvents.length} 課金イベント</span>
        </div>
        <div className="day-stepper">
          <button
            type="button"
            className="reload-button"
            disabled={!prevDay}
            onClick={() => prevDay && onSelectDay(prevDay)}
          >
            ← 前の日
          </button>
          <button
            type="button"
            className="reload-button"
            disabled={!nextDay}
            onClick={() => nextDay && onSelectDay(nextDay)}
          >
            次の日 →
          </button>
        </div>
      </div>

      {dayEvents.length === 0 ? (
        <div className="panel wide">
          <p className="meta">この日の課金イベントはありません。</p>
        </div>
      ) : (
        <>
          <DaySummaryCards
            dayEvents={dayEvents}
            timeZone={timeZone}
            totalCost={totalCost}
            rank={costRank}
            dayCount={days.length}
          />
          <div className="grid">
            <HourlyChart dayEvents={dayEvents} timeZone={timeZone} />
            <ModelPie dayEvents={dayEvents} />
            <UserChart dayEvents={dayEvents} />
            <KindBreakdown dayEvents={dayEvents} />
            <DayEventsTable dayEvents={dayEvents} timeZone={timeZone} />
          </div>
        </>
      )}
    </div>
  );
}
