import type { UsageEvent } from "../../src/core/types.ts";

import { formatTokens } from "../../src/core/format.ts";
import { useCostVisibility } from "./CostVisibility.tsx";
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

/**
 * Event table used by Overview and Daily Window detail.
 *
 * Callers supply already-sorted rows, the time-column header, and a timestamp
 * formatter so Overview can show full datetimes while Daily Window shows clock time.
 */
export function EventsTable({
  events,
  timeZone,
  title,
  timeHeader,
  formatTimestamp,
  wrapClassName = "table-wrap",
}: {
  events: UsageEvent[];
  timeZone: string;
  title: string;
  timeHeader: string;
  formatTimestamp: (date: Date, timeZone: string) => string;
  wrapClassName?: string;
}) {
  const { formatCost } = useCostVisibility();
  return (
    <details className="panel wide analysis-disclosure" open>
      <summary>{title}</summary>
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
              <th className="num">Total</th>
              <th className="num">Cost</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
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
                <td className="num">{formatTokens(e.totalTokens)}</td>
                <td className="num">{formatCost(e.cost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
