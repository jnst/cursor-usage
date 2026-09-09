# Architecture Decision Records

ADRs are kept in this file. Each record states the decision, the current implementation, and a one-line rationale. Keep Current State up to date; reference the owning ADR instead of duplicating details.

## ADR-001: Use a User-Selectable Analysis Time Zone

### Decision

Group Daily Windows and Hours in a user-selectable Analysis Time Zone.

### Current State (Single Source of Truth)

The Analysis Time Zone defaults to the user's environment and can be overridden for each analysis in the CLI and dashboard. It determines Daily Window and Hour boundaries.

### Rationale

Analysis should follow the user's working calendar.

## ADR-002: Keep Usage Data Local

### Decision

Process Usage Exports locally without implicit uploads or default persistence of usage data.

### Current State (Single Source of Truth)

The dashboard parses CSV files in browser memory; the local server serves static assets, and the CLI reads local files. Usage Exports, parsed events, and derived cost/token data are not persisted in browser storage. Non-sensitive UI preferences may be persisted; usage-data persistence or explicit, opt-in transmission requires a separate decision.

### Rationale

Usage Exports can contain sensitive user and usage information.

## ADR-003: Do Not Treat cursor-usage as a Billing Audit Tool

### Decision

Analyze reported usage trends and costs without auditing billing.

### Current State (Single Source of Truth)

Cost comes from the CSV `Cost` column, not reconstructed model prices. Pricing validation, invoice reconciliation, and accounting workflows are outside the product scope.

### Rationale

Reported usage supports trend analysis without establishing billing correctness.

## ADR-004: Treat URLs as View State, Not Data Sharing

### Decision

Encode analysis view state in URLs without including Usage Export data.

### Current State (Single Source of Truth)

URLs preserve view selections; recipients must load the same Usage Export locally. Daily Window links include the Daily Window Key, Analysis Time Zone, and non-midnight start hour so boundaries remain consistent across environments. Dashboard Metric compatibility is defined in ADR-011.

### Rationale

A shared view should reproduce the same analysis boundaries while keeping usage data local.

## ADR-005: Ground Analysis Features in the CLI

### Decision

Provide every analysis capability in the CLI before or alongside the dashboard.

### Current State (Single Source of Truth)

CLI options expose Daily Window, User, Model Family, Analysis Time Zone, start hour, Selected Metric, No Charge Event inclusion, and specialized rankings and groupings. Browser-only interactions such as file dropping and chart layout do not require CLI equivalents.

### Rationale

Analysis must be reproducible in scripts, terminals, and support conversations.

## ADR-006: Use Daily Windows Instead of Calendar Days

### Decision

Use Daily Windows starting at a selected hour for one-day analysis.

### Current State (Single Source of Truth)

Daily Windows use the Analysis Time Zone and selected start hour; CLI options, URLs, and domain names use Daily Window terminology. General analysis defaults to midnight. Daily Reports use the latest Daily Window in the export and a 05:00 start hour.

### Rationale

Work sessions can continue past midnight.

## ADR-007: Group Model Charts by Model Family, with Auto as One Router-Level Family

### Decision

Group Model charts by Model Family and all Auto routing usage into one `Auto` family.

### Current State (Single Source of Truth)

Normalization collapses reasoning-effort, thinking, and fast suffixes in any order, strips zero-width characters, and falls back to variant-stripped or raw identifiers for unknown Models. Auto identifiers and routed display names share one family. Original Models remain available in event tables and JSON; dashboard drilldown and CLI `--model-family Auto` expose Model-level detail.

### Rationale

Family grouping keeps charts readable despite variant proliferation and changing Router names.

## ADR-008: Colocate Unit Tests with Implementation

### Decision

Keep unit tests beside their implementation and cross-module tests in `tests/`.

### Current State (Single Source of Truth)

Unit tests use adjacent `*.test.ts` files. `tests/cli-metric.test.ts` covers CLI integration. `bun test` discovers both locations, and the published package ships only `dist/`.

### Rationale

Colocation makes tests visible when their implementation changes.

## ADR-009: Rank and Display CLI Analysis by a Selected Metric

### Decision

Let CLI analysis select Cost or Token Count as its primary Metric.

### Current State (Single Source of Truth)

CLI `stats --metric cost|tokens` controls ranking and display order, defaulting to Cost. Effective Rate remains a diagnostic. Dashboard presentation is owned by ADR-011, which supersedes the original dashboard Metric switch.

### Rationale

Token Count distinguishes usage volume from reported Cost.

## ADR-010: Period Charts Show Missing Daily Windows as Zero

### Decision

Render missing time intervals as zero in period displays.

### Current State (Single Source of Truth)

Daily Window charts and CLI series include every key from the first to last Active Daily Window; Hourly charts include every Hour in the window. Missing intervals have zero Cost, Token Count, and Event Count. Rankings, summaries, and averages still use Active Daily Windows, while category breakdowns remain sparse.

### Rationale

Omitting idle intervals makes discontinuous activity look continuous.

## ADR-011: Show Cost and Token Count Together for Sharing

### Decision

Show both Metrics simultaneously in dashboard views and screenshots.

### Current State (Single Source of Truth)

Overview and Daily Window views stack full-width Cost and Token Count charts with matching ranges and Model Family colors; overview charts share a legend and stack order. Summaries show both Metrics. The Model Family breakdown has a local Cost / Token Count toggle, including drilldown, defaulting to Cost for screenshots. Screenshot width is 1400 pixels with full-page capture; Daily Reports show the top ten events by Cost, and Daily Window exports support an explicit event limit. Legacy `metric` URLs and screenshot `--metric` remain accepted without hiding either Metric; new dashboard navigation omits `metric`. Current layout and disclosure behavior are owned by ADR-017 and ADR-015.

### Rationale

One screenshot should communicate both reported Cost and usage volume.

## ADR-012: Rank Users by Aggregate Effective Rate

### Decision

Rank Users by aggregate reported Cost per million tokens, with independent ordering for each User ranking.

### Current State (Single Source of Truth)

`実行単価 Top 10` calculates `Cost / Token Count * 1,000,000` from Billable Events and shows supporting totals. Users with zero aggregate tokens or Cost are excluded using unrounded values; no minimum volume threshold applies. Rankings sort the full comparison set before taking ten, break ties by User identifier, and retain that set when a User is selected. `高い順` / `低い順` toggles are independent; Cost and Token Count default descending, Effective Rate ascending. CLI `--by user-effective-rate` and `--user-order asc|desc` share these rules; overview and Daily Window JSON expose `topUsersByEffectiveRate` and effective `userRankingOrder` values.

### Rationale

Aggregate Effective Rate reveals reported unit-cost differences caused by Model and cache mix, not productivity or quality.

## ADR-013: Show Cloud Agent Usage Rate by User

### Decision

Measure Cloud Agent usage as the share of each User's Billable Events with a Cloud Agent ID.

### Current State (Single Source of Truth)

`Cloud Agent使用率 Top 10` defaults to descending order and follows the comparison-set and ordering rules in ADR-012. Each event counts once, including repeated IDs; Automation IDs alone do not qualify. Missing IDs count as non-Cloud events, Users with zero Cloud Agent events remain eligible, and Users without Billable Events are absent. Values and supporting counts are available through CLI `--by user-cloud-agent`, `--user-order`, and JSON `topUsersByCloudAgentUsage`. The display uses a fixed 0–100% scale; current ranking layout is owned by ADR-017.

### Rationale

Event share describes Cloud Agent adoption independently of Cost and Token Count.

## ADR-014: Hide Displayed Costs for Sharing

### Decision

Allow totals and individual costs to be masked as a display preference.

### Current State (Single Source of Truth)

Costs default to visible. The dashboard toggle stays in memory across User and Daily Window navigation; screenshot and Daily Report exports accept `--hide-costs`. Hidden costs render directly as `***` across totals, cumulative values, details, and tooltips; monetary axis ticks are blank. Averages and Effective Rate remain visible, as do tokens, proportions, ordering, and chart shapes. CSV and CLI stats/JSON stay numeric. This is not redaction: visible rates and counts can reveal totals.

### Rationale

Users need shareable displays without changing the underlying analysis.

## ADR-015: Keep Detail Sections Initially Open and Collapsible

### Decision

Make detail sections collapsible while showing them by default.

### Current State (Single Source of Truth)

Event tables and Cloud Agent analysis use native disclosures that start open in overview, Daily Window views, and screenshots. Collapsing them does not change event selection, deduplication, or aggregation.

### Rationale

Users can shorten the page without hiding detail on initial viewing.

## ADR-016: Group Cloud Agent IDs Within the Current Analysis Scope

### Decision

Group Billable Events by Cloud Agent ID within the current period and filters.

### Current State (Single Source of Truth)

Trimmed, nonempty IDs form groups across Users and Daily Windows, including zero-cost groups and excluding No Charge Events. Above the event table, four Top 10 charts show per-ID Cost, Token Count, Event Count, and unique IDs per User; shared IDs count once per participating User. Summaries include group count, totals, mean/median/max Cost, and the top ten IDs' share of Cloud Agent Cost. Labels lead with first observation in the Analysis Time Zone; tooltips retain full IDs and supporting details. Detail rows show the highest-cost 20 groups with displayed/total counts, full IDs, Users, model event counts, and observation timestamps; ties use identifiers. Summaries, rankings, CLI `stats --by cloud-agent`, and JSON `cloudAgentAnalysis` use all groups, including model totals. Empty input produces zero summaries and an empty state. Cost masking includes maximum and per-ID costs but leaves mean and median visible; JSON stays numeric. Groups and observed timestamps do not establish task completion, success, lifetime cost, or runtime.

### Rationale

Grouping repeated IDs reveals concentrated Cloud Agent usage within the available export scope.

## ADR-017: Use Ranked Rows with Background Bars for User Top 10

### Decision

Present User rankings as readable ranked rows alongside a responsive Model Family breakdown.

### Current State (Single Source of Truth)

Rows show rank, selectable full User identifier, a right-aligned primary value, supporting metrics, and a subtle background bar. Bars scale to the maximum displayed value except Cloud Agent Usage Rate, which uses 100%. Ordering, comparison sets, and cost visibility follow ADR-012 through ADR-014. The page maximum is 2000 pixels. Viewports of at least 1800 pixels show the Model Family panel and four rankings in one row; medium widths place the Model Family panel across two rows beside the rankings, then smaller widths use two and one columns. Donuts scale with panel width in a square area, and the complete wrapping legend stays in normal flow at content height.

### Rationale

Full identifiers and responsive sizing keep rankings readable across viewport sizes.
