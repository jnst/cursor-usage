import type { Metric, UsageEvent } from "../../src/core/types.ts";

import { formatTokens, formatUsd, metricLabel } from "../../src/core/format.ts";
import { ModelCell } from "./ModelCell.tsx";

function eventRowKey(event: UsageEvent): string {
  return [
    event.date.toISOString(),
    event.user,
    event.model,
    event.kind,
    event.totalTokens,
    event.cost,
  ].join("|");
}

function SortedHeader({ active, children }: { active: boolean; children: string }) {
  return (
    <th className={active ? "num sorted" : "num"} aria-sort={active ? "descending" : undefined}>
      {children}
    </th>
  );
}

/**
 * Event table used by Overview and Daily Window detail.
 *
 * Callers supply already-sorted rows. The selected Metric is the rightmost
 * column and the table heading, so Cost vs Token Count is visible in the
 * same place as ranking.
 */
export function EventsTable({
  events,
  timeZone,
  title,
  timeHeader,
  formatTimestamp,
  metric,
  wrapClassName = "table-wrap",
}: {
  events: UsageEvent[];
  timeZone: string;
  title: string;
  timeHeader: string;
  formatTimestamp: (date: Date, timeZone: string) => string;
  metric: Metric;
  wrapClassName?: string;
}) {
  const metricHeading = metricLabel(metric);
  const otherHeading = metricLabel(metric === "tokens" ? "cost" : "tokens");
  return (
    <div className="panel wide">
      <h3>{title}</h3>
      <div className={wrapClassName}>
        <table>
          <thead>
            <tr>
              <th>{timeHeader}</th>
              <th>ユーザー</th>
              <th>モデル</th>
              <th>種別</th>
              <th className="num">Input</th>
              <th className="num">Cache Read</th>
              <th className="num">Output</th>
              <SortedHeader active={false}>{otherHeading}</SortedHeader>
              <SortedHeader active>{metricHeading}</SortedHeader>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => {
              const tokenCell = formatTokens(e.totalTokens);
              const costCell = formatUsd(e.cost);
              const primary = metric === "tokens" ? tokenCell : costCell;
              const secondary = metric === "tokens" ? costCell : tokenCell;
              return (
                <tr key={eventRowKey(e)}>
                  <td>{formatTimestamp(e.date, timeZone)}</td>
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
                  <td className="num">{secondary}</td>
                  <td className="num sorted">{primary}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
