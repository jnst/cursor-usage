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

The dashboard may encode the selected view in the URL, such as a selected Daily Window, User, Analysis Time Zone, and Daily Window start hour, but it must not encode or upload the Usage Export itself. A shared URL can reopen the same view state only after the recipient loads the same Usage Export locally.

When a URL includes a Daily Window, that Daily Window Key is interpreted in the selected Analysis Time Zone and start hour, not as a UTC date. This keeps shared detail views aligned with the same window boundaries users see in the dashboard.

Daily Window URLs should include the selected Daily Window, Analysis Time Zone, and start hour when the start hour is not midnight. Omitting the Analysis Time Zone or non-default start hour makes the same URL resolve to different event ranges for users in different environments.

## ADR-005: Ground Analysis Features in the CLI

Every analysis capability should be available from the CLI before or alongside the web UI. The web dashboard may provide richer interactions and charts, but those interactions should correspond to CLI options so the same analysis can be reproduced in scripts, terminals, CI logs, and support conversations.

Purely browser-specific affordances, such as drag-and-drop file loading or chart layout, do not require CLI equivalents. Analysis choices such as Daily Window, User, Analysis Time Zone, Daily Window start hour, and whether No Charge Events are included do require CLI support.

## ADR-006: Use Daily Windows Instead of Calendar Days

Usage analysis often needs to describe work sessions that continue past midnight. We will model one-day analysis as Daily Windows: 24-hour windows that start at a selected hour in the Analysis Time Zone. A midnight-start Daily Window preserves the usual calendar-aligned behavior, while a 05:00-start Daily Window can represent late-night work as one continuous work session.

This replaces Day as the domain concept for one-day grouping. Public CLI options, URL state, and implementation names should use Daily Window language rather than Day language. The Daily Report screenshot mode uses the latest Daily Window in the Usage Export and defaults to a 05:00 start hour because it is optimized for sharing recent work activity, while general Daily Window analysis defaults to a midnight start hour.
