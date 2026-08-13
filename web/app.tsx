import type { AnalysisContext, UsageEvent } from "../src/core/types.ts";

import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";

import { filterEvents } from "../src/core/aggregate.ts";
import { parseUsageCsv } from "../src/core/parse.ts";
import {
  defaultAnalysisTimeZone,
  isValidDailyWindowKey,
  isValidStartHour,
  isValidTimeZone,
} from "../src/core/time.ts";
import { DailyWindowView } from "./components/DailyWindowView.tsx";
import { DropZone } from "./components/DropZone.tsx";
import { Overview } from "./components/Overview.tsx";

type SerializedUsageEvent = Omit<UsageEvent, "date"> & { date: string };

declare global {
  interface Window {
    __CURSOR_USAGE_EVENTS__?: SerializedUsageEvent[];
    __CURSOR_USAGE_SCREENSHOT__?: boolean;
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
  ctx: AnalysisContext;
  eventLimit: number | null;
} {
  const params = new URLSearchParams(window.location.hash.slice(1));
  const dailyWindow = params.get("daily-window");
  const user = params.get("user");
  const timeZone = params.get("timezone");
  const startHour = Number(params.get("start-hour") ?? 0);
  const eventLimit = Number(params.get("event-limit"));
  return {
    dailyWindow: dailyWindow && isValidDailyWindowKey(dailyWindow) ? dailyWindow : null,
    user: user || null,
    ctx: {
      timeZone: timeZone && isValidTimeZone(timeZone) ? timeZone : defaultTimeZone,
      startHour: isValidStartHour(startHour) ? startHour : 0,
    },
    eventLimit: Number.isInteger(eventLimit) && eventLimit > 0 ? eventLimit : null,
  };
}

/** Selected Daily Window and Analysis Time Zone, kept in sync with the URL hash. */
function useDailyWindowRoute(): {
  selectedDailyWindow: string | null;
  selectedUser: string | null;
  ctx: AnalysisContext;
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
    ctx: AnalysisContext,
    eventLimit: number | null,
  ) => {
    if (dailyWindow || user) {
      const params = new URLSearchParams({ timezone: ctx.timeZone });
      if (dailyWindow) params.set("daily-window", dailyWindow);
      if (user) params.set("user", user);
      if (ctx.startHour !== 0) params.set("start-hour", String(ctx.startHour));
      if (eventLimit !== null) params.set("event-limit", String(eventLimit));
      window.location.hash = params.toString();
    } else if (window.location.hash) {
      window.history.pushState(null, "", window.location.pathname + window.location.search);
    }
    setRoute({ dailyWindow, user, ctx, eventLimit });
  };

  return {
    selectedDailyWindow: route.dailyWindow,
    selectedUser: route.user,
    ctx: route.ctx,
    eventLimit: route.eventLimit,
    setSelectedDailyWindow: (dailyWindow) =>
      updateHash(dailyWindow, route.user, route.ctx, route.eventLimit),
    setSelectedUser: (user) => updateHash(route.dailyWindow, user, route.ctx, route.eventLimit),
  };
}

function App() {
  const [allEvents, setAllEvents] = useState<UsageEvent[] | null>(() => initialEvents());
  const [error, setError] = useState<string | null>(null);
  const showControls = window.__CURSOR_USAGE_SCREENSHOT__ !== true;
  const {
    selectedDailyWindow,
    selectedUser,
    ctx,
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

  const userEvents = useMemo(() => (allEvents ? filterEvents(allEvents) : null), [allEvents]);
  const events = useMemo(
    () => (allEvents ? filterEvents(allEvents, { user: selectedUser ?? undefined }) : null),
    [allEvents, selectedUser],
  );
  const noChargeCount = allEvents && userEvents ? allEvents.length - userEvents.length : 0;
  const clearDailyWindow = () => {
    if (events && showControls) setSelectedDailyWindow(null);
  };

  return (
    <div className="app">
      <div className="header">
        <h1
          className={events && showControls ? "clickable-title" : undefined}
          onClick={clearDailyWindow}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") clearDailyWindow();
          }}
          role={events && showControls ? "button" : undefined}
          tabIndex={events && showControls ? 0 : undefined}
        >
          Cursor Usage
        </h1>
        {events && (
          <>
            <span className="meta">
              {events.length} 課金イベント
              {noChargeCount > 0 && ` (No Charge ${noChargeCount}件を除外)`}
            </span>
            {showControls && (
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
            )}
          </>
        )}
      </div>
      {events ? (
        selectedDailyWindow ? (
          <DailyWindowView
            events={events}
            dailyWindow={selectedDailyWindow}
            ctx={ctx}
            eventLimit={eventLimit ?? undefined}
            showControls={showControls}
            onBack={() => setSelectedDailyWindow(null)}
            onSelectDailyWindow={setSelectedDailyWindow}
            onSelectUser={(user) => setSelectedUser(user === selectedUser ? null : user)}
            selectedUser={selectedUser}
            userEvents={userEvents ?? events}
          />
        ) : (
          <Overview
            events={events}
            userEvents={userEvents ?? events}
            ctx={ctx}
            showControls={showControls}
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

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found.");
createRoot(root).render(<App />);
