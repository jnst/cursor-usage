import type { UsageEvent } from "../../src/core/types.ts";

import { useId } from "react";

import { hasFastMode } from "../../src/core/model.ts";

type ModelEvent = Pick<UsageEvent, "model" | "cloudAgentId" | "automationId" | "maxMode">;

function CloudIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
    </svg>
  );
}

function BotIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 8V4H8" />
      <rect width="16" height="12" x="4" y="8" rx="2" />
      <path d="M2 14h2" />
      <path d="M20 14h2" />
      <path d="M15 13v2" />
      <path d="M9 13v2" />
    </svg>
  );
}

function MaxIcon() {
  const rawId = useId().replace(/:/g, "");
  const gradId = `max-grad-${rawId}`;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="26"
      height="12"
      viewBox="0 0 26 12"
      aria-hidden
      className="model-mark-max-svg"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#81a1c1" />
          <stop offset="100%" stopColor="#7d7c9b" />
        </linearGradient>
      </defs>
      <text
        x="13"
        y="9.5"
        textAnchor="middle"
        fill={`url(#${gradId})`}
        fontSize="10"
        fontWeight="700"
        fontFamily='ui-sans-serif, system-ui, "Segoe UI", sans-serif'
        style={{ textTransform: "uppercase" }}
      >
        Max
      </text>
    </svg>
  );
}

function FastIcon() {
  const rawId = useId().replace(/:/g, "");
  const gradId = `fast-grad-${rawId}`;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="30"
      height="12"
      viewBox="0 0 30 12"
      aria-hidden
      className="model-mark-fast-svg"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#8fbcbb" />
          <stop offset="100%" stopColor="#a3be8c" />
        </linearGradient>
      </defs>
      <text
        x="15"
        y="9.5"
        textAnchor="middle"
        fill={`url(#${gradId})`}
        fontSize="10"
        fontWeight="700"
        fontFamily='ui-sans-serif, system-ui, "Segoe UI", sans-serif'
        style={{ textTransform: "uppercase" }}
      >
        Fast
      </text>
    </svg>
  );
}

/**
 * Model name with optional Event Labels.
 *
 * Order matches CONTEXT: Cloud Agent → Automation → Max Mode → Fast Mode.
 */
export function ModelCell({ event }: { event: ModelEvent }) {
  return (
    <span className="model-cell">
      <span className="badge">{event.model}</span>
      {event.cloudAgentId && (
        <span className="model-mark" title={`Cloud Agent: ${event.cloudAgentId}`}>
          <CloudIcon />
          <span className="sr-only">Cloud Agent</span>
        </span>
      )}
      {event.automationId && (
        <span className="model-mark" title={`Automation: ${event.automationId}`}>
          <BotIcon />
          <span className="sr-only">Automation</span>
        </span>
      )}
      {event.maxMode && (
        <span className="model-mark model-mark-max" title="Max Mode">
          <MaxIcon />
          <span className="sr-only">Max Mode</span>
        </span>
      )}
      {hasFastMode(event.model) && (
        <span className="model-mark model-mark-fast" title="Fast Mode">
          <FastIcon />
          <span className="sr-only">Fast Mode</span>
        </span>
      )}
    </span>
  );
}
