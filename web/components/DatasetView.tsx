import type { AnalysisContext, UsageEvent } from "../../src/core/types.ts";

import { memo, useMemo } from "react";

import { filterEvents } from "../../src/core/aggregate.ts";
import { DailyWindowView } from "./DailyWindowView.tsx";
import { Overview } from "./Overview.tsx";

/** Keep each dataset's rendered charts and memoized analysis between toggles. */
export const DatasetView = memo(function DatasetView({
  allEvents,
  dailyWindow,
  selectedUser,
  ctx,
  eventLimit,
  showControls,
  onBack,
  onSelectDailyWindow,
  onSelectUser,
}: {
  allEvents: UsageEvent[];
  dailyWindow: string | null;
  selectedUser: string | null;
  ctx: AnalysisContext;
  eventLimit: number | null;
  showControls: boolean;
  onBack: () => void;
  onSelectDailyWindow: (dailyWindow: string) => void;
  onSelectUser: (user: string) => void;
}) {
  const userEvents = useMemo(() => filterEvents(allEvents), [allEvents]);
  const events = useMemo(
    () => (selectedUser ? userEvents.filter((event) => event.user === selectedUser) : userEvents),
    [userEvents, selectedUser],
  );
  const shared = {
    events,
    userEvents,
    ctx,
    showControls,
    selectedUser,
    onSelectDailyWindow,
    onSelectUser,
  };
  return dailyWindow ? (
    <DailyWindowView
      {...shared}
      dailyWindow={dailyWindow}
      eventLimit={eventLimit ?? undefined}
      onBack={onBack}
    />
  ) : (
    <Overview {...shared} />
  );
});
