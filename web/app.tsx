import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  billable,
  defaultAnalysisTimeZone,
  isValidTimeZone,
} from "../src/core/aggregate.ts";
import { parseUsageCsv } from "../src/core/parse.ts";
import type { UsageEvent } from "../src/core/types.ts";
import { Dashboard } from "./components/Dashboard.tsx";
import { DayDetail } from "./components/DayDetail.tsx";
import { DropZone } from "./components/DropZone.tsx";

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
      setAllEvents(parsed);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const events = useMemo(
    () => (allEvents ? billable(allEvents) : null),
    [allEvents],
  );
  const excluded = allEvents && events ? allEvents.length - events.length : 0;

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
              {events.length} 課金イベント
              {excluded > 0 && ` (No Charge ${excluded}件を除外)`}
            </span>
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
          <DayDetail
            events={events}
            day={selectedDay}
            timeZone={timeZone}
            onBack={() => setSelectedDay(null)}
            onSelectDay={setSelectedDay}
          />
        ) : (
          <Dashboard
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
