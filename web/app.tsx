import type { Language } from "../src/core/language.ts";
import type { MessageKey } from "./i18n/messages.ts";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { DatasetView } from "./components/DatasetView.tsx";
import { DropZone } from "./components/DropZone.tsx";
import { DummyDataLoading } from "./components/DummyDataLoading.tsx";
import { DummyDataToggle } from "./components/DummyDataToggle.tsx";
import { LanguageSelector } from "./components/LanguageSelector.tsx";
import { LanguageProvider, initialLanguage, useLanguage } from "./i18n/LanguageProvider.tsx";
import { useDummyData } from "./useDummyData.ts";

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

  const updateHash = useCallback(
    (
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
    },
    [defaultTimeZone],
  );

  const setSelectedDailyWindow = useCallback(
    (dailyWindow: string | null) =>
      updateHash(dailyWindow, route.user, route.ctx, route.eventLimit),
    [route, updateHash],
  );
  const setSelectedUser = useCallback(
    (user: string | null) => updateHash(route.dailyWindow, user, route.ctx, route.eventLimit),
    [route, updateHash],
  );

  return {
    selectedDailyWindow: route.dailyWindow,
    selectedUser: route.user,
    ctx: route.ctx,
    eventLimit: route.eventLimit,
    setSelectedDailyWindow,
    setSelectedUser,
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

  const dummy = useDummyData(() => {
    if (selectedUser !== null) setSelectedUser(null);
  });
  const onBack = useCallback(() => setSelectedDailyWindow(null), [setSelectedDailyWindow]);
  const onSelectUser = useCallback(
    (user: string) => setSelectedUser(user === selectedUser ? null : user),
    [selectedUser, setSelectedUser],
  );

  const onCsvText = (text: string) => {
    try {
      const parsed = parseUsageCsv(text);
      if (parsed.length === 0) {
        setError({ key: "No Usage Events could be read from the CSV." });
        return;
      }
      setError(null);
      setAllEvents(parsed);
      dummy.setCsv(text);
    } catch (e) {
      setError(
        e instanceof MissingColumnError
          ? { key: "missingColumn", params: { column: e.column } }
          : { key: "Could not load the CSV." },
      );
    }
  };

  const displayedEvents = dummy.events ?? allEvents;
  const userEvents = useMemo(
    () => (displayedEvents ? filterEvents(displayedEvents) : null),
    [displayedEvents],
  );
  const events = useMemo(
    () =>
      selectedUser && userEvents
        ? userEvents.filter((event) => event.user === selectedUser)
        : userEvents,
    [userEvents, selectedUser],
  );
  const noChargeCount =
    displayedEvents && userEvents ? displayedEvents.length - userEvents.length : 0;
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
                <DummyDataToggle
                  active={dummy.isDummy}
                  preparing={dummy.preparing}
                  onToggle={() => void dummy.toggle()}
                />
                <button
                  type="button"
                  className="reload-button"
                  onClick={() => {
                    setSelectedDailyWindow(null);
                    setSelectedUser(null);
                    setAllEvents(null);
                    dummy.setCsv(null);
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
      {events && dummy.preparing && <DummyDataLoading />}
      {events && dummy.failed && (
        <p className="dummy-data-error" role="alert">
          {t("Could not convert the CSV to dummy data.")}
        </p>
      )}
      {allEvents ? (
        <div className="dataset-views">
          {([allEvents, dummy.cachedEvents] as const).map(
            (dataset, index) =>
              dataset && (
                <div
                  key={index}
                  className="dataset-view"
                  data-active={dummy.isDummy === (index === 1)}
                  inert={dummy.isDummy !== (index === 1)}
                >
                  <DatasetView
                    allEvents={dataset}
                    dailyWindow={selectedDailyWindow}
                    selectedUser={dummy.isDummy === (index === 1) ? selectedUser : null}
                    ctx={ctx}
                    eventLimit={eventLimit}
                    showControls={showControls}
                    onBack={onBack}
                    onSelectDailyWindow={setSelectedDailyWindow}
                    onSelectUser={onSelectUser}
                  />
                </div>
              ),
          )}
        </div>
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
