import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  billable,
  defaultAnalysisTimeZone,
  isValidTimeZone,
} from "../src/core/aggregate.ts";
import { parseUsageCsv } from "../src/core/parse.ts";
import type { UsageEvent } from "../src/core/types.ts";
import { DayView } from "./components/DayView.tsx";
import { DropZone } from "./components/DropZone.tsx";
import { Overview } from "./components/Overview.tsx";

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const COMMON_TIME_ZONES = [
  "UTC",
  "Asia/Tokyo",
  "America/Los_Angeles",
  "America/New_York",
  "Europe/London",
];

function routeFromHash(defaultTimeZone: string): {
  day: string | null;
  timeZone: string;
} {
  const params = new URLSearchParams(window.location.hash.slice(1));
  const day = params.get("day");
  const timeZone = params.get("timezone");
  return {
    day: day && DAY_PATTERN.test(day) ? day : null,
    timeZone: timeZone && isValidTimeZone(timeZone) ? timeZone : defaultTimeZone,
  };
}

/** Selected Day and Analysis Time Zone, kept in sync with the URL hash. */
function useDayRoute(): {
  selectedDay: string | null;
  timeZone: string;
  setSelectedDay: (day: string | null) => void;
  setTimeZone: (timeZone: string) => void;
} {
  const defaultTimeZone = useMemo(() => defaultAnalysisTimeZone(), []);
  const [route, setRoute] = useState(() => routeFromHash(defaultTimeZone));

  useEffect(() => {
    const onHashChange = () => setRoute(routeFromHash(defaultTimeZone));
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [defaultTimeZone]);

  const updateHash = (day: string | null, timeZone: string) => {
    if (day) {
      const params = new URLSearchParams({ day, timezone: timeZone });
      window.location.hash = params.toString();
    } else if (window.location.hash) {
      window.history.pushState(
        null,
        "",
        window.location.pathname + window.location.search,
      );
    }
    setRoute({ day, timeZone });
  };

  return {
    selectedDay: route.day,
    timeZone: route.timeZone,
    setSelectedDay: (day) => updateHash(day, route.timeZone),
    setTimeZone: (timeZone) => {
      if (!isValidTimeZone(timeZone)) return;
      updateHash(route.day, timeZone);
    },
  };
}

function App() {
  const [allEvents, setAllEvents] = useState<UsageEvent[] | null>(null);
  const [includeNoCharge, setIncludeNoCharge] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { selectedDay, timeZone, setSelectedDay, setTimeZone } = useDayRoute();

  const onCsvText = (text: string) => {
    try {
      const parsed = parseUsageCsv(text);
      if (parsed.length === 0) {
        setError("CSVから利用イベントを読み取れませんでした。");
        return;
      }
      setError(null);
      setIncludeNoCharge(false);
      setAllEvents(parsed);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const billableEvents = useMemo(
    () => (allEvents ? billable(allEvents) : null),
    [allEvents],
  );
  const events = includeNoCharge ? allEvents : billableEvents;
  const noChargeCount =
    allEvents && billableEvents ? allEvents.length - billableEvents.length : 0;
  const eventLabel = includeNoCharge ? "イベント" : "課金イベント";

  return (
    <div className="app">
      <div className="header">
        <h1
          className={events ? "clickable-title" : undefined}
          onClick={() => events && setSelectedDay(null)}
        >
          Cursor Usage
        </h1>
        {events && (
          <>
            <span className="meta">
              {events.length} {eventLabel}
              {noChargeCount > 0 &&
                (includeNoCharge
                  ? ` (No Charge ${noChargeCount}件を含む)`
                  : ` (No Charge ${noChargeCount}件を除外)`)}
            </span>
            <label className="filter-toggle">
              <input
                type="checkbox"
                checked={includeNoCharge}
                onChange={(e) => setIncludeNoCharge(e.target.checked)}
              />
              No Chargeを含める
            </label>
            <label className="timezone-select">
              <span>Time Zone</span>
              <select
                value={timeZone}
                onChange={(e) => setTimeZone(e.target.value)}
              >
                {[
                  ...new Set([
                    timeZone,
                    defaultAnalysisTimeZone(),
                    ...COMMON_TIME_ZONES,
                  ]),
                ].map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="reload-button"
              onClick={() => {
                setSelectedDay(null);
                setIncludeNoCharge(false);
                setAllEvents(null);
                setError(null);
              }}
            >
              別のCSVを読み込む
            </button>
          </>
        )}
      </div>
      {events ? (
        selectedDay ? (
          <DayView
            events={events}
            day={selectedDay}
            timeZone={timeZone}
            eventLabel={eventLabel}
            onBack={() => setSelectedDay(null)}
            onSelectDay={setSelectedDay}
          />
        ) : (
          <Overview
            events={events}
            timeZone={timeZone}
            onSelectDay={setSelectedDay}
          />
        )
      ) : (
        <DropZone onCsvText={onCsvText} error={error} />
      )}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
