# Architecture Decision Records

This file records design decisions for cursor-usage. The repository is intentionally small, so ADRs are kept together in this single file.

## ADR-001: Use a User-Selectable Analysis Time Zone

Usage exports contain timestamps, but cost analysis is interpreted by users in their working calendar, not necessarily UTC. We will group Daily Windows and Hours using an Analysis Time Zone that defaults from the user's environment and can be overridden for a specific analysis, so users such as JST-based teams can make daily cost views match their actual workday.

This rejects treating UTC as the default boundary for one-day analysis. UTC may still be useful as a raw timestamp representation, but it should not define Daily Window boundaries for analysis.

## ADR-002: Keep Usage Data Local

This tool may be used by people other than the author, and Cursor usage-events exports can contain sensitive user, model, token, and cost data. We will keep usage data local: the web dashboard reads and analyzes CSV files in the browser, the local server only serves static assets, and the CLI reads local files without uploading them.

Sending usage data to a remote service is outside the default product boundary and must not happen implicitly. Any future feature that transmits usage data must be explicit, opt-in, and justified as a separate security-sensitive decision.

The web dashboard should not persist the Usage Export contents, parsed Usage Events, or derived cost/token data by default. It may persist non-sensitive UI preferences, such as the selected Analysis Time Zone, but storing usage data in browser storage should require a separate decision if performance or usability makes it necessary.

## ADR-003: Do Not Treat cursor-usage as a Billing Audit Tool

cursor-usage is for visualizing usage trends and cost shape from Cursor's usage-events CSV export, not for auditing invoices or reconstructing billing logic. The CSV `Cost` column is treated as the reported cost for analysis, but the tool does not validate Cursor's pricing, reproduce model rates, or serve as an accounting source of truth.

This keeps the product boundary focused: the tool helps users notice expensive days, models, users, and usage patterns, while billing disputes, tax/accounting workflows, and invoice reconciliation remain outside its scope.

## ADR-004: Treat URLs as View State, Not Data Sharing

The dashboard may encode the selected view in the URL, such as a selected Daily Window, User, Selected Metric, Analysis Time Zone, and Daily Window start hour, but it must not encode or upload the Usage Export itself. A shared URL can reopen the same view state only after the recipient loads the same Usage Export locally.

When a URL includes a Daily Window, that Daily Window Key is interpreted in the selected Analysis Time Zone and start hour, not as a UTC date. This keeps shared detail views aligned with the same window boundaries users see in the dashboard.

Daily Window URLs should include the selected Daily Window, Analysis Time Zone, and start hour when the start hour is not midnight. Omitting the Analysis Time Zone or non-default start hour makes the same URL resolve to different event ranges for users in different environments.

## ADR-005: Ground Analysis Features in the CLI

Every analysis capability should be available from the CLI before or alongside the web UI. The web dashboard may provide richer interactions and charts, but those interactions should correspond to CLI options so the same analysis can be reproduced in scripts, terminals, CI logs, and support conversations.

Purely browser-specific affordances, such as drag-and-drop file loading or chart layout, do not require CLI equivalents. Analysis choices such as Daily Window, User, Analysis Time Zone, Daily Window start hour, Selected Metric, and whether No Charge Events are included do require CLI support.

## ADR-006: Use Daily Windows Instead of Calendar Days

Usage analysis often needs to describe work sessions that continue past midnight. We will model one-day analysis as Daily Windows: 24-hour windows that start at a selected hour in the Analysis Time Zone. A midnight-start Daily Window preserves the usual calendar-aligned behavior, while a 05:00-start Daily Window can represent late-night work as one continuous work session.

This replaces Day as the domain concept for one-day grouping. Public CLI options, URL state, and implementation names should use Daily Window language rather than Day language. The Daily Report screenshot mode uses the latest Daily Window in the Usage Export and defaults to a 05:00 start hour because it is optimized for sharing recent work activity, while general Daily Window analysis defaults to a midnight start hour.

## ADR-007: Group Model Charts by Model Family, with Auto as One Router-Level Family

Usage Exports report Models at variant granularity: one underlying model appears as many identifiers that differ only by reasoning effort (`high`, `xhigh`, `medium`, `low`, `max`), thinking, fast mode, and Auto routing display names such as `Opus 5 (Auto Balanced)`. Real exports contain 40+ Model identifiers, which makes stacked charts and pie legends unreadable. We will group cost charts by Model Family: the Model with variant attributes collapsed.

Usage routed through Auto (Cursor Router) is grouped into a single `Auto` Model Family regardless of Router mode (Intelligence, Balance, Cost) or routed Model, because the routing decision — not the user's model choice — drove the cost. The Models that Auto actually selected stay visible one level down: the web dashboard drills from the Model Family pie into a Model-level breakdown, and the CLI accepts a Model Family filter (`--model-family Auto`) that shows the same Model-level detail.

This partially revises the earlier stance that Model Family aggregation is intentionally not introduced. Model remains the identifier reported by the Usage Export and remains the key for event-level tables and JSON output; Model Family is an additional analysis axis derived locally by normalization. Normalization must tolerate naming churn: unknown identifiers fall back to their variant-stripped slug (or the raw identifier) so new models still group across their variants without a release, and parsing strips zero-width characters and accepts variant suffixes in any order because real exports contain both.

## ADR-008: Colocate Unit Tests with Implementation

Unit tests live next to the module they cover, using the `*.test.ts` suffix (`src/core/parse.ts` and `src/core/parse.test.ts`). This keeps the test for a module visible when that module changes.

A top-level `tests/` directory is reserved for tests that span multiple modules or entry points, such as CLI or dashboard flows. There are none yet.

This rejects keeping all tests in `tests/` by default. `bun test` already discovers `*.test.ts` recursively, and the published package only ships `dist/`, so colocated tests are not included in the npm tarball.

## ADR-009: Rank and Display Analysis by a Selected Metric

Cost-only analysis cannot tell unused Daily Windows from cheap-model or low-reported-cost usage. We will let the analysis choose a Selected Metric of Cost or Token Count (default Cost). Rankings, summaries, event tables, and the single stacked Daily Window chart all use that Metric. The same Daily Window columns, Model Family colors, and chart geometry are reused; only the encoded value changes. Switching twice compares the two shapes by visual memory. Effective Rate (`$ / MTok`) stays visible as a diagnostic.

This rejects overlaying Cost and Token Count on dual Y axes, and rejects small-multiples (two stacked charts). Dual axes already served daily Cost versus cumulative Cost; a third incommensurable scale would mislead. Two charts would double legend, axis, and hover complexity.

The CLI accepts `--metric cost|tokens` so the same analysis can be reproduced outside the dashboard (ADR-005). The dashboard stores the choice in the URL hash as `metric=cost|tokens` (ADR-004).

## ADR-010: Period Charts Show Missing Daily Windows as Zero

A Daily Window Range is a continuous period. Usage Exports omit days with no events, so aggregating only present rows drops idle days (often Sundays) and makes the series look like consecutive workdays.

Period displays — the stacked Daily Window chart, the CLI Daily Window series, and Hourly charts inside a Daily Window — must include every Daily Window Key or Hour in the displayed span. Missing CSV rows render as Cost 0, Token Count 0, and Event Count 0.

This does not change Active Daily Window. Rankings, summaries, and Avg Daily Cost / Avg Daily Token Count still divide by windows that have at least one Billable Event. Category breakdowns (User, Model, Model Family, Kind) stay sparse: they are not a time period.

This rejects skipping empty days on a period axis. An empty Sunday is information: usage was zero that window, not that the window did not exist.
