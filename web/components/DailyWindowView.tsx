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
import { useLanguage } from "../i18n/LanguageProvider.tsx";
import { CloudAgentAnalysis } from "./CloudAgentAnalysis.tsx";
import { useCostVisibility } from "./CostVisibility.tsx";
import { EventsTable } from "./EventsTable.tsx";
import { ModelFamilyPanel } from "./ModelFamilyPanel.tsx";
import { modelFamilyColors, tooltipItemStyle, tooltipStyle } from "./shared.ts";
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
  const { t } = useLanguage();
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
          label: t("Spend"),
          value: formatUsd(s.totalCost),
          sub: t("periodShare", {
            share: share(s.totalCost, period.totalCost),
            rank: rank("cost"),
            count: windows.length,
          }),
        },
        {
          label: t("Tokens"),
          value: formatTokens(s.totalTokens),
          sub: t("periodShare", {
            share: share(s.totalTokens, period.totalTokens),
            rank: rank("tokens"),
            count: windows.length,
          }),
        },
        {
          label: t("Effective Rate"),
          value: formatUsdPerMTok(s.totalCost, s.totalTokens),
          sub: "$ / MTok",
        },
        {
          label: t("Events"),
          value: String(s.eventCount),
          sub: t("modelsUsers", { models: s.modelCount, users: s.userCount }),
        },
      ]}
    />
  );
}

/**
 * Hourly tooltip: selected Metric → other Metric → Effective Rate.
 */
function HourlyMetricTooltip({ metric, ...props }: TooltipContentProps & { metric: Metric }) {
  const { t } = useLanguage();
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
      name: t(metric === "tokens" ? "Tokens" : "Spend"),
      value: metric === "tokens" ? tokens : cost,
    },
    {
      ...template,
      dataKey: "other",
      name: t(otherMetric === "tokens" ? "Tokens" : "Spend"),
      value: otherMetric === "tokens" ? tokens : cost,
      color: "#8b949e",
      fill: "#8b949e",
    },
    {
      ...template,
      dataKey: "rate",
      name: t("Effective Rate"),
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
  const { t } = useLanguage();
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
  const name = t(metric === "tokens" ? "Tokens" : "Spend");

  return (
    <div className="panel wide">
      <h3>
        {t(metric === "tokens" ? "Tokens by Hour" : "Spend by Hour")} ({ctx.timeZone})
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
  const { t } = useLanguage();
  const { formatCost: formatUsd } = useCostVisibility();
  const data = byKind(dailyWindowEvents);
  return (
    <div className="panel wide">
      <h3>{t("Breakdown by Kind")}</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{t("Kind")}</th>
              <th className="num">{t("Events")}</th>
              <th className="num">{t("Spend")}</th>
              <th className="num">{t("Tokens")}</th>
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
  const { t } = useLanguage();
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
  const eventTitle =
    eventLimit === undefined
      ? t("dailyEvents", { count: eventRows.length })
      : t("dailyTopEvents", {
          limit: eventLimit,
          count: eventRows.length,
          total: dailyWindowEvents.length,
        });
  const idx = dailyWindows.indexOf(dailyWindow);
  const prevDailyWindow = idx > 0 ? dailyWindows[idx - 1] : undefined;
  const nextDailyWindow =
    idx >= 0 && idx < dailyWindows.length - 1 ? dailyWindows[idx + 1] : undefined;

  return (
    <div className="daily-window-view">
      <div className="daily-window-nav">
        {showControls && (
          <button type="button" className="reload-button" onClick={onBack}>
            ← {t("Back to overview")}
          </button>
        )}
        <div className="daily-window-title">
          <h2>{dailyWindow}</h2>
          <span className="meta">
            {t("dailyMeta", {
              count: dailyWindowEvents.length,
              zone: ctx.timeZone,
              hour: ctx.startHour,
            })}
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
              ← {t("Previous Daily Window")}
            </button>
            <button
              type="button"
              className="reload-button"
              disabled={!nextDailyWindow}
              onClick={() => nextDailyWindow && onSelectDailyWindow(nextDailyWindow)}
            >
              {t("Next Daily Window")} →
            </button>
          </div>
        )}
      </div>

      {dailyWindowEvents.length === 0 ? (
        <div className="panel wide">
          <p className="meta">{t("There are no Billable Events in this Daily Window.")}</p>
        </div>
      ) : (
        <>
          {selectedUser && <p className="meta">{t("selectedUser", { user: selectedUser })}</p>}
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
                timeHeader={t("clockTime", { zone: ctx.timeZone })}
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
