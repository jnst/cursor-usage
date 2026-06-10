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
  byDayAndModel,
  byModel,
  byUser,
  summarize,
  topEvents,
} from "../../src/core/aggregate.ts";
import type { UsageEvent } from "../../src/core/types.ts";

const COLORS = [
  "#58a6ff", // blue
  "#3fb950", // green
  "#d29922", // amber
  "#f778ba", // pink
  "#a371f7", // purple
  "#ff7b72", // coral
  "#39c5cf", // cyan
  "#e3b341", // gold
  "#7ee787", // light green
  "#ffa657", // orange
  "#d2a8ff", // lavender
  "#79c0ff", // light blue
  "#f85149", // red
  "#56d364", // emerald
  "#ec8e2c", // pumpkin
  "#bc8cff", // violet
  "#54aeff", // azure
  "#9e6a03", // bronze
  "#ff9bce", // rose
  "#6e7681", // gray
];

export function formatUsd(value: number): string {
  return `$${value.toFixed(2)}`;
}

export function formatTokens(value: number): string {
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return String(value);
}

const tooltipStyle = {
  backgroundColor: "#161b22",
  border: "1px solid #21262d",
  borderRadius: 8,
  fontSize: 12,
} as const;

function SummaryCards({ events }: { events: UsageEvent[] }) {
  const s = useMemo(() => summarize(events), [events]);
  const cards = [
    { label: "Total Cost", value: formatUsd(s.totalCost), sub: `${s.firstDay} – ${s.lastDay}` },
    { label: "Avg Cost / Day", value: formatUsd(s.avgCostPerDay), sub: `${s.dayCount} days` },
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

function DailyChart({ events }: { events: UsageEvent[] }) {
  const models = useMemo(
    () => byModel(events).map((m) => m.key),
    [events],
  );
  const data = useMemo(() => {
    let cumulative = 0;
    return byDayAndModel(events).map((d) => {
      cumulative += d.totalCost;
      return { day: d.day.slice(5), ...d.costByModel, cumulative };
    });
  }, [events]);

  return (
    <div className="panel wide">
      <h3>日別コスト推移(モデル別積み上げ + 累積)</h3>
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={data}>
          <CartesianGrid stroke="#21262d" vertical={false} />
          <XAxis dataKey="day" stroke="#8b949e" fontSize={12} />
          <YAxis
            yAxisId="cost"
            stroke="#8b949e"
            fontSize={12}
            tickFormatter={(v: number) => `$${v}`}
          />
          <YAxis
            yAxisId="cumulative"
            orientation="right"
            stroke="#8b949e"
            fontSize={12}
            tickFormatter={(v: number) => `$${v}`}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value) => formatUsd(Number(value))}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {models.map((model, i) => (
            <Bar
              key={model}
              yAxisId="cost"
              dataKey={model}
              stackId="cost"
              fill={COLORS[i % COLORS.length]}
            />
          ))}
          <Line
            yAxisId="cumulative"
            dataKey="cumulative"
            name="累積"
            stroke="#e6edf3"
            strokeWidth={2}
            dot={false}
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
      <h3>モデル別コスト構成</h3>
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

function UserChart({ events }: { events: UsageEvent[] }) {
  const data = useMemo(() => byUser(events).slice(0, 10), [events]);
  return (
    <div className="panel">
      <h3>ユーザー別コスト (Top 10)</h3>
      <ResponsiveContainer width="100%" height={280}>
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
          <Bar dataKey="cost" name="Cost" fill="#58a6ff" radius={[0, 4, 4, 0]} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function TopEventsTable({ events }: { events: UsageEvent[] }) {
  const top = useMemo(() => topEvents(events, 20), [events]);
  return (
    <div className="panel wide">
      <h3>高コストイベント Top 20</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>日時 (UTC)</th>
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
            {top.map((e, i) => (
              <tr key={i}>
                <td>{e.date.toISOString().replace("T", " ").slice(0, 16)}</td>
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

export function Dashboard({ events }: { events: UsageEvent[] }) {
  return (
    <>
      <SummaryCards events={events} />
      <div className="grid">
        <DailyChart events={events} />
        <ModelPie events={events} />
        <UserChart events={events} />
        <TopEventsTable events={events} />
      </div>
    </>
  );
}
