import { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { billable } from "../src/core/aggregate.ts";
import { parseUsageCsv } from "../src/core/parse.ts";
import type { UsageEvent } from "../src/core/types.ts";
import { Dashboard } from "./components/Dashboard.tsx";
import { DropZone } from "./components/DropZone.tsx";

function App() {
  const [allEvents, setAllEvents] = useState<UsageEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        <h1>Cursor Usage</h1>
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
        <Dashboard events={events} />
      ) : (
        <DropZone onCsvText={onCsvText} error={error} />
      )}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
