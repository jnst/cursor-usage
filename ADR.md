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

The dashboard presentation decision is superseded by ADR-011. CLI metric selection remains supported.

Cost-only analysis cannot tell unused Daily Windows from cheap-model or low-reported-cost usage. We will let the analysis choose a Selected Metric of Cost or Token Count (default Cost). Rankings, summaries, event tables, and the single stacked Daily Window chart all use that Metric. The same Daily Window columns, Model Family colors, and chart geometry are reused; only the encoded value changes. Switching twice compares the two shapes by visual memory. Effective Rate (`$ / MTok`) stays visible as a diagnostic.

This rejects overlaying Cost and Token Count on dual Y axes, and rejects small-multiples (two stacked charts). Dual axes already served daily Cost versus cumulative Cost; a third incommensurable scale would mislead. Two charts would double legend, axis, and hover complexity.

The CLI accepts `--metric cost|tokens` so the same analysis can be reproduced outside the dashboard (ADR-005). The dashboard stores the choice in the URL hash as `metric=cost|tokens` (ADR-004).

## ADR-010: Period Charts Show Missing Daily Windows as Zero

A Daily Window Range is a continuous period. Usage Exports omit days with no events, so aggregating only present rows drops idle days (often Sundays) and makes the series look like consecutive workdays.

Period displays — the stacked Daily Window chart, the CLI Daily Window series, and Hourly charts inside a Daily Window — must include every Daily Window Key or Hour in the displayed span. Missing CSV rows render as Cost 0, Token Count 0, and Event Count 0.

This does not change Active Daily Window. Rankings, summaries, and Avg Daily Cost / Avg Daily Token Count still divide by windows that have at least one Billable Event. Category breakdowns (User, Model, Model Family, Kind) stay sparse: they are not a time period.

This rejects skipping empty days on a period axis. An empty Sunday is information: usage was zero that window, not that the window did not exist.

## ADR-011: Show Cost and Token Count Together for Sharing

The four-column breakdown layout is superseded by ADR-013. The full-width time series and 1400-pixel dashboard maximum remain in effect.

Comparing Cost and Token Count through tabs requires two screenshots. The dashboard will show both Metrics simultaneously in the overview and Daily Window view so one screenshot communicates cost and usage volume. This supersedes ADR-009's single-chart and dashboard Metric-switching decision.

Cost and Token Count use separate full-width charts stacked vertically, Cost first and Token Count immediately below, with the same time range and Model Family colors; the overview charts share one legend and family stack order. Each chart has its own units and scale. Summary cards show both totals and averages (or Daily Window shares and ranks). User Cost and Token Count Top 10 rankings are visible together. Model Family breakdowns use one panel in the first column of a four-column row immediately after the time-series charts, followed by User Cost, Token Count, and Effective Rate Top 10 panels, with a local Cost / Token Count toggle defaulting to Cost. This toggle also applies to Model-level drilldown and does not change the time-series charts or User rankings; screenshot exports use the default Cost breakdown. Reserve the donut area independently of the legend; show as many complete legend rows as fit in the remaining panel height, without a fixed row limit. All Model Families remain in the donut, and slice tooltips show the family name on the first line and selected Metric value on the next line. Narrow screens stack the panels vertically.

Prioritize readable month-long time series and visual comparison over fitting a fixed viewport or page height. Do not halve the time-series chart width to put Metrics side by side. Model Family breakdowns and event details are always visible, without collapsible sections. The dashboard maximum width and screenshot width are 1400 pixels: after outer padding and three column gaps, each of the four panels has 328 pixels, while full-width charts still show every date in a 31-day month. Full-page capture allows a long single image. An explicit Daily Window event limit limits event rows; Daily Reports show the top 10 events by Cost.

CLI `stats --metric cost|tokens` still selects terminal ranking and display order. Legacy dashboard `metric` URL values and screenshot `--metric` options remain accepted but do not hide either Metric. New dashboard navigation omits `metric` from URLs.

## ADR-012: Rank Users by Aggregate Effective Rate

Each dashboard User Top 10 panel has an independent `高い順` / `低い順` toggle. Defaults remain descending for Cost and Token Count and ascending for Effective Rate, including screenshots. Sort the complete comparison set before selecting ten Users; changing order must not merely reverse the currently displayed ten. The CLI exposes `--user-order asc|desc` for User rankings, with the same per-Metric defaults when omitted. JSON includes the effective `userRankingOrder` values. Other analysis axes are unaffected.

Show User Effective Rate Top 10, lowest first, alongside User Cost and Token Count rankings. Calculate each User's rate as total reported Cost divided by total Token Count, multiplied by 1,000,000 (`$ / MTok`), never as the arithmetic mean of event rates. Display Cost and Token Count with the rate so low-volume usage is visible. Do not impose a minimum usage threshold.

Exclude No Charge Events from this ranking even when another CLI breakdown explicitly includes them, and exclude Users with zero total tokens or zero total reported Cost. Eligibility is based on unrounded aggregate values; positive Cost remains eligible even if its display rounds to zero. Break ties by User identifier for stable ordering. Use the same Analysis Time Zone and Daily Window boundaries as other analysis; dashboard User rankings retain the comparison set when a User is selected, matching existing User-chart behavior.

This is a diagnostic of reported unit cost, not a productivity or quality score: Model and cache mix affect the result (ADR-003). The visible label is `実行単価 Top 10`. The CLI provides `stats --by user-effective-rate`, and both overview and Daily Window JSON include `topUsersByEffectiveRate` with numeric rates and totals (ADR-005).

## ADR-013: Show Cloud Agent Usage and Restore Horizontal User Bars

Cloud Agent Usage Rate is the percentage of a User's Billable Events with a nonempty Cloud Agent ID. Count event rows, not distinct IDs: repeated use of the same agent counts for each event. Exclude No Charge Events from both numerator and denominator. Automation IDs alone do not imply Cloud Agent usage. Users with no Cloud Agent events remain eligible at 0%; Users without Billable Events are absent. The rate is event-based, not weighted by Cost or Token Count, and missing IDs count as non-Cloud events.

Add `Cloud Agent使用率 Top 10`, highest first by default, with an independent ascending/descending toggle. Apply the same Daily Window boundaries and User comparison set as the other rankings. Break ties by User identifier, and sort all Users before selecting ten. CLI `--by user-cloud-agent` exposes the ranking, `--user-order` controls its order, and overview/Daily Window JSON include `topUsersByCloudAgentUsage` with percentages, Cloud Agent event counts, and total Billable Event counts.

Replace the four-column breakdown row with a Model Family panel followed by four User horizontal bar charts in two columns and two rows: Cost and Token Count above Effective Rate and Cloud Agent Usage Rate. Keep each order toggle beside its title. Bars and User labels support the existing User selection, including zero-valued Users through their labels. Tooltips show identifiers and supporting totals; Cloud Agent tooltips show the percentage and numerator/denominator. The percentage axis always spans 0–100. Narrow screens stack the charts and allow horizontal scrolling within charts when necessary for readable User labels.

## ADR-014: Hide Displayed Costs for Sharing

A dashboard-wide visibility toggle masks totals and individual costs with `••••`, including cost axes, cumulative values, tooltips, model detail, ranking tooltips, and event tables. Average costs and Effective Rate stay visible, as do tokens, proportions, order, and chart shapes. Default to visible costs, and keep the toggle in memory for the current page; User or Daily Window navigation preserves it. Screenshot and Daily Report exports accept `--hide-costs`.

This is a display preference, not data redaction or access control: average costs or Effective Rate combined with counts can reconstruct totals. CSV input and CLI stats/JSON stay numeric and unchanged. Format masked text directly rather than hiding an unmasked DOM text node with CSS.

## ADR-015: Keep Detail Sections Initially Open and Collapsible

Event tables use native disclosure controls and start open in both overview and Daily Window views, including screenshot exports. This revises ADR-011's ban on collapsible sections: the user can now collapse detail while keeping it visible by default. Keep the existing event selection and deduplication behavior; collapsing a section does not change analysis.

## ADR-016: Group Cloud Agent IDs Within the Current Analysis Scope

Group Billable Events by trimmed, nonempty Cloud Agent ID within the current period and filters. Repeated IDs across Users or Daily Windows remain one group. Include zero-cost groups; exclude No Charge Events even when other CLI analyses include them. These groups do not establish task count, success, lifetime cost, or runtime. First/last observation timestamps describe only exported events in scope.

Above the event table, show an initially open native disclosure with four horizontal Top 10 charts: per-ID Cost, Token Count, Event Count, and unique ID count per User. Show ID count, aggregate totals, mean/median/max per-ID Cost, and the percentage of Cloud Agent Cost from the ten highest-cost IDs. A shared ID counts once for each participating User. Detail rows retain full IDs, Users, model event counts, and observation timestamps, ordered by Cost descending. Ties use identifiers for stable ordering. Empty input yields zero summary metrics and an explicit empty state.

Cost visibility applies to totals, maximum, per-ID costs, axes and tooltips; mean and median stay visible. CLI `stats --by cloud-agent` and overview/Daily Window JSON `cloudAgentAnalysis` expose the shared aggregation, including model totals. All JSON values stay numeric.

Cloud Agent chart labels now lead with first observation in the Analysis Time Zone, because opaque IDs do not identify recognizable activity. Hover shows the timestamp, Users, usage totals and full ID with a subtle highlight. The dashboard detail table is explicitly labeled and limited to the highest-cost 20 groups, with displayed/total counts; summaries, rankings and CLI/JSON continue to use all groups.

## ADR-017: Use Ranked Rows with Background Bars for User Top 10

Restore readable User ranking lists with rank, selectable full User identifier, and a right-aligned primary value. Encode relative magnitude as a subtle background bar across each row. Use the maximum displayed value as the scale, except Cloud Agent Usage Rate which uses a fixed 100%. Put complementary metrics below without dot separators or repeating the primary cost. Preserve independent ordering, comparison-set selection, and cost visibility. The four rankings remain in two columns and two rows on wide screens.

The Model Family panel shares the ranking grid instead of occupying its own row. Wide viewports (1800px and above) show all five panels in one row, within a 2000px page limit. Medium viewports use three columns with the Model Family panel spanning two rows beside the four rankings. Smaller viewports progressively use two and then one column.
