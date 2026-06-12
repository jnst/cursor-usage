import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { billable } from "../src/core/aggregate.ts";
import { parseUsageCsv } from "../src/core/parse.ts";
import type { UsageEvent } from "../src/core/types.ts";
import { Dashboard } from "./components/Dashboard.tsx";
import { DayDetail } from "./components/DayDetail.tsx";
import { DropZone } from "./components/DropZone.tsx";

const DAY_HASH = /^#day=(\d{4}-\d{2}-\d{2})$/;

function dayFromHash(): string | null {
  return DAY_HASH.exec(window.location.hash)?.[1] ?? null;
}

/** Selected day, kept in sync with the URL hash so the browser back button works. */
function useDayRoute(): [string | null, (day: string | null) => void] {
  const [day, setDay] = useState<string | null>(() => dayFromHash());

  useEffect(() => {
    const onHashChange = () => setDay(dayFromHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const navigate = (next: string | null) => {
    if (next) {
      window.location.hash = `day=${next}`;
    } else if (window.location.hash) {
      window.history.pushState(
        null,
        "",
        window.location.pathname + window.location.search,
      );
    }
    setDay(next);
  };

  return [day, navigate];
}

function App() {
  const [allEvents, setAllEvents] = useState<UsageEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useDayRoute();

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
            onBack={() => setSelectedDay(null)}
            onSelectDay={setSelectedDay}
          />
        ) : (
          <Dashboard events={events} onSelectDay={setSelectedDay} />
        )
      ) : (
        <DropZone onCsvText={onCsvText} error={error} />
      )}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
