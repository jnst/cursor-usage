import type { UsageEvent } from "../src/core/types.ts";

import { useRef, useState } from "react";

import { parseUsageCsv } from "../src/core/parse.ts";

type Source = { text: string; converted: UsageEvent[] | null; pending: boolean };
const EMPTY = { events: null, preparing: false, failed: false };

// Leave a frame for the progress message before synchronous CSV processing,
// including when the transformation module is already in the browser cache.
function afterPaint(): Promise<void> {
  return new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
}

/** Convert only on demand, cache per loaded CSV, and ignore obsolete async results. */
export function useDummyData(onModeChange: () => void) {
  const source = useRef<Source | null>(null);
  const onChange = useRef(onModeChange);
  onChange.current = onModeChange;
  const [state, setState] = useState<{
    events: UsageEvent[] | null;
    preparing: boolean;
    failed: boolean;
  }>(EMPTY);

  const setCsv = (text: string | null) => {
    source.current = text === null ? null : { text, converted: null, pending: false };
    setState(EMPTY);
  };

  const toggle = async () => {
    const current = source.current;
    if (!current || current.pending) return;
    if (state.events) {
      onChange.current();
      setState(EMPTY);
      return;
    }
    if (current.converted) {
      onChange.current();
      setState({ events: current.converted, preparing: false, failed: false });
      return;
    }

    current.pending = true;
    setState({ events: null, preparing: true, failed: false });
    try {
      const [{ sanitizeCsv }] = await Promise.all([
        import("../src/core/sanitize.ts"),
        afterPaint(),
      ]);
      if (source.current !== current) return;
      const converted = parseUsageCsv(sanitizeCsv(current.text));
      current.converted = converted;
      // Future toggles use the parsed datasets, so release the source CSV text.
      current.text = "";
      onChange.current();
      setState({ events: converted, preparing: true, failed: false });
      // Keep the modal in place through the first chart layout and paint.
      await afterPaint();
      if (source.current === current)
        setState({ events: converted, preparing: false, failed: false });
    } catch {
      if (source.current === current) {
        setState({ events: null, preparing: false, failed: true });
      }
    } finally {
      current.pending = false;
    }
  };

  return {
    ...state,
    isDummy: state.events !== null,
    cachedEvents: source.current?.converted ?? null,
    setCsv,
    toggle,
  };
}
