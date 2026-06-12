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

function routeFromHash(defaultTimeZone: string): {
  day: string | null;
  user: string | null;
  timeZone: string;
} {
  const params = new URLSearchParams(window.location.hash.slice(1));
  const day = params.get("day");
  const user = params.get("user");
  const timeZone = params.get("timezone");
  return {
    day: day && DAY_PATTERN.test(day) ? day : null,
    user: user || null,
    timeZone: timeZone && isValidTimeZone(timeZone) ? timeZone : defaultTimeZone,
  };
}

/** Selected Day and Analysis Time Zone, kept in sync with the URL hash. */
function useDayRoute(): {
  selectedDay: string | null;
  selectedUser: string | null;
  timeZone: string;
  setSelectedDay: (day: string | null) => void;
  setSelectedUser: (user: string | null) => void;
} {
  const defaultTimeZone = useMemo(() => defaultAnalysisTimeZone(), []);
  const [route, setRoute] = useState(() => routeFromHash(defaultTimeZone));

  useEffect(() => {
    const onHashChange = () => setRoute(routeFromHash(defaultTimeZone));
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [defaultTimeZone]);

  const updateHash = (
    day: string | null,
    user: string | null,
    timeZone: string,
  ) => {
    if (day || user) {
      const params = new URLSearchParams({ timezone: timeZone });
      if (day) params.set("day", day);
      if (user) params.set("user", user);
      window.location.hash = params.toString();
    } else if (window.location.hash) {
      window.history.pushState(
        null,
        "",
        window.location.pathname + window.location.search,
      );
    }
    setRoute({ day, user, timeZone });
  };

  return {
    selectedDay: route.day,
    selectedUser: route.user,
    timeZone: route.timeZone,
    setSelectedDay: (day) => updateHash(day, route.user, route.timeZone),
    setSelectedUser: (user) => updateHash(route.day, user, route.timeZone),
  };
}

function App() {
  const [allEvents, setAllEvents] = useState<UsageEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const {
    selectedDay,
    selectedUser,
    timeZone,
    setSelectedDay,
    setSelectedUser,
  } = useDayRoute();

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

  const billableEvents = useMemo(
    () => (allEvents ? billable(allEvents) : null),
    [allEvents],
  );
  const baseEvents = billableEvents;
  const events = useMemo(
    () =>
      baseEvents && selectedUser
        ? baseEvents.filter((e) => e.user === selectedUser)
        : baseEvents,
    [baseEvents, selectedUser],
  );
  const noChargeCount =
    allEvents && billableEvents ? allEvents.length - billableEvents.length : 0;

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
              {noChargeCount > 0 &&
                ` (No Charge ${noChargeCount}件を除外)`}
            </span>
            {selectedUser && (
              <button
                type="button"
                className="filter-chip"
                onClick={() => setSelectedUser(null)}
                title="ユーザーフィルタを解除"
              >
                User: {selectedUser} ×
              </button>
            )}
            <button
              type="button"
              className="reload-button"
              onClick={() => {
                setSelectedDay(null);
                setSelectedUser(null);
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
            onBack={() => setSelectedDay(null)}
            onSelectDay={setSelectedDay}
            onSelectUser={setSelectedUser}
          />
        ) : (
          <Overview
            events={events}
            timeZone={timeZone}
            onSelectDay={setSelectedDay}
            onSelectUser={setSelectedUser}
          />
        )
      ) : (
        <DropZone onCsvText={onCsvText} error={error} />
      )}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
