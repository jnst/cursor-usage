import type { Language } from "../src/core/language.ts";
import type { MessageKey } from "./i18n/messages.ts";

import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";

import { filterEvents } from "../src/core/aggregate.ts";
import { parseUsageCsv, MissingColumnError } from "../src/core/parse.ts";
import {
  defaultAnalysisTimeZone,
  isValidDailyWindowKey,
  isValidStartHour,
  isValidTimeZone,
} from "../src/core/time.ts";
import { type AnalysisContext, type UsageEvent } from "../src/core/types.ts";
import { CostVisibilityProvider, CostVisibilityToggle } from "./components/CostVisibility.tsx";
import { DailyWindowView } from "./components/DailyWindowView.tsx";
import { DropZone } from "./components/DropZone.tsx";
import { LanguageSelector } from "./components/LanguageSelector.tsx";
import { Overview } from "./components/Overview.tsx";
import { LanguageProvider, initialLanguage, useLanguage } from "./i18n/LanguageProvider.tsx";

type SerializedUsageEvent = Omit<UsageEvent, "date"> & { date: string };

declare global {
  interface Window {
    __CURSOR_USAGE_EVENTS__?: SerializedUsageEvent[];
    __CURSOR_USAGE_SCREENSHOT__?: boolean;
    __CURSOR_USAGE_HIDE_COSTS__?: boolean;
    __CURSOR_USAGE_LANGUAGE__?: Language;
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
    if (
      dailyWindow ||
      user ||
      ctx.timeZone !== defaultTimeZone ||
      ctx.startHour !== 0 ||
      eventLimit !== null
    ) {
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
  const { t } = useLanguage();
  const [allEvents, setAllEvents] = useState<UsageEvent[] | null>(() => initialEvents());
  const [error, setError] = useState<{ key: MessageKey; params?: Record<string, string> } | null>(
    null,
  );
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
        setError({ key: "No Usage Events could be read from the CSV." });
        return;
      }
      setError(null);
      setAllEvents(parsed);
    } catch (e) {
      setError(
        e instanceof MissingColumnError
          ? { key: "missingColumn", params: { column: e.column } }
          : { key: "Could not load the CSV." },
      );
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
          <svg viewBox="0 0 16 16" width="22" height="22" aria-hidden="true">
            <rect x="1" y="8" width="3" height="7" fill="#58a6ff" />
            <rect x="6" y="4" width="3" height="11" fill="#3fb950" />
            <rect x="11" y="1" width="3" height="14" fill="#d29922" />
          </svg>
          Cursor Usage
        </h1>
        {events && (
          <span className="meta">
            {t("billableCount", { count: events.length })}
            {noChargeCount > 0 && t("excludedCount", { count: noChargeCount })}
          </span>
        )}
        {showControls && (
          <div className="header-actions">
            <LanguageSelector />
            {events && (
              <>
                <CostVisibilityToggle />
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
                  {t("Load another CSV")}
                </button>
              </>
            )}
          </div>
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
        <DropZone
          onCsvText={onCsvText}
          error={error ? t(error.key, error.params) : null}
          onReadError={() => setError({ key: "Could not read the file. Please choose it again." })}
        />
      )}
    </div>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found.");
const language = initialLanguage();
document.documentElement.lang = language;
createRoot(root).render(
  <LanguageProvider initial={language}>
    <CostVisibilityProvider>
      <App />
    </CostVisibilityProvider>
  </LanguageProvider>,
);
