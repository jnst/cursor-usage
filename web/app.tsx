import type { UsageEvent } from "../src/core/types.ts";

import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";

import {
  billable,
  defaultAnalysisTimeZone,
  isValidStartHour,
  isValidTimeZone,
} from "../src/core/aggregate.ts";
import { parseUsageCsv } from "../src/core/parse.ts";
import { DailyWindowView } from "./components/DayView.tsx";
import { DropZone } from "./components/DropZone.tsx";
import { Overview } from "./components/Overview.tsx";

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type SerializedUsageEvent = Omit<UsageEvent, "date"> & { date: string };

declare global {
  interface Window {
    __CURSOR_USAGE_EVENTS__?: SerializedUsageEvent[];
  }
}

function initialEvents(): UsageEvent[] | null {
  const serialized = window.__CURSOR_USAGE_EVENTS__;
  if (!serialized) return null;
  return serialized.map((event) => ({ ...event, date: new Date(event.date) }));
}

function routeFromHash(defaultTimeZone: string): {
  dailyWindow: string | null;
  user: string | null;
  timeZone: string;
  startHour: number;
  eventLimit: number | null;
} {
  const params = new URLSearchParams(window.location.hash.slice(1));
  const dailyWindow = params.get("daily-window");
  const user = params.get("user");
  const timeZone = params.get("timezone");
  const startHour = Number(params.get("start-hour") ?? 0);
  const eventLimit = Number(params.get("event-limit"));
  return {
    dailyWindow: dailyWindow && DAY_PATTERN.test(dailyWindow) ? dailyWindow : null,
    user: user || null,
    timeZone: timeZone && isValidTimeZone(timeZone) ? timeZone : defaultTimeZone,
    startHour: isValidStartHour(startHour) ? startHour : 0,
    eventLimit: Number.isInteger(eventLimit) && eventLimit > 0 ? eventLimit : null,
  };
}

/** Selected Daily Window and Analysis Time Zone, kept in sync with the URL hash. */
function useDailyWindowRoute(): {
  selectedDailyWindow: string | null;
  selectedUser: string | null;
  timeZone: string;
  startHour: number;
  eventLimit: number | null;
  setSelectedDailyWindow: (dailyWindow: string | null) => void;
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
    dailyWindow: string | null,
    user: string | null,
    timeZone: string,
    startHour: number,
    eventLimit: number | null,
  ) => {
    if (dailyWindow || user) {
      const params = new URLSearchParams({ timezone: timeZone });
      if (dailyWindow) params.set("daily-window", dailyWindow);
      if (user) params.set("user", user);
      if (startHour !== 0) params.set("start-hour", String(startHour));
      if (eventLimit !== null) params.set("event-limit", String(eventLimit));
      window.location.hash = params.toString();
    } else if (window.location.hash) {
      window.history.pushState(null, "", window.location.pathname + window.location.search);
    }
    setRoute({ dailyWindow, user, timeZone, startHour, eventLimit });
  };

  return {
    selectedDailyWindow: route.dailyWindow,
    selectedUser: route.user,
    timeZone: route.timeZone,
    startHour: route.startHour,
    eventLimit: route.eventLimit,
    setSelectedDailyWindow: (dailyWindow) =>
      updateHash(dailyWindow, route.user, route.timeZone, route.startHour, route.eventLimit),
    setSelectedUser: (user) =>
      updateHash(route.dailyWindow, user, route.timeZone, route.startHour, route.eventLimit),
  };
}

function App() {
  const [allEvents, setAllEvents] = useState<UsageEvent[] | null>(() => initialEvents());
  const [error, setError] = useState<string | null>(null);
  const {
    selectedDailyWindow,
    selectedUser,
    timeZone,
    startHour,
    eventLimit,
    setSelectedDailyWindow,
    setSelectedUser,
  } = useDailyWindowRoute();

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

  const billableEvents = useMemo(() => (allEvents ? billable(allEvents) : null), [allEvents]);
  const baseEvents = billableEvents;
  const events = useMemo(
    () =>
      baseEvents && selectedUser ? baseEvents.filter((e) => e.user === selectedUser) : baseEvents,
    [baseEvents, selectedUser],
  );
  const noChargeCount = allEvents && billableEvents ? allEvents.length - billableEvents.length : 0;

  return (
    <div className="app">
      <div className="header">
        <h1
          className={events ? "clickable-title" : undefined}
          onClick={() => events && setSelectedDailyWindow(null)}
        >
          Cursor Usage
        </h1>
        {events && (
          <>
            <span className="meta">
              {events.length} 課金イベント
              {noChargeCount > 0 && ` (No Charge ${noChargeCount}件を除外)`}
            </span>
            <button
              type="button"
              className="reload-button"
              onClick={() => {
                setSelectedDailyWindow(null);
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
        selectedDailyWindow ? (
          <DailyWindowView
            events={events}
            dailyWindow={selectedDailyWindow}
            timeZone={timeZone}
            startHour={startHour}
            eventLimit={eventLimit ?? undefined}
            onBack={() => setSelectedDailyWindow(null)}
            onSelectDailyWindow={setSelectedDailyWindow}
            onSelectUser={(user) => setSelectedUser(user === selectedUser ? null : user)}
            selectedUser={selectedUser}
            userEvents={baseEvents ?? events}
          />
        ) : (
          <Overview
            events={events}
            userEvents={baseEvents ?? events}
            timeZone={timeZone}
            startHour={startHour}
            onSelectDailyWindow={setSelectedDailyWindow}
            onSelectUser={(user) => setSelectedUser(user === selectedUser ? null : user)}
            selectedUser={selectedUser}
          />
        )
      ) : (
        <DropZone onCsvText={onCsvText} error={error} />
      )}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
