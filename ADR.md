# Architecture Decision Records

ADRs are the Single Source of Truth for confirmed architectural decisions and their background and intent, regardless of implementation status.

## Writing Rules

- Decision: State what was decided in one sentence—the conclusion only.
- Current State (Single Source of Truth): State the architectural decisions currently in effect, including their confirmed scope, behavior, and constraints, regardless of implementation status. Update this section when a decision changes. This section records what is decided today, not implementation progress, unresolved proposals, or general commentary.
- Rationale: Summarize the background and intent behind the decision in one sentence. Do not reproduce the full discussion.
- Record architectural structure and behavioral policies; omit transitional parameter values and low-level implementation steps.

## ADR-001: Use a User-Selectable Analysis Time Zone

### Decision

Group Daily Windows and Hours in a user-selectable Analysis Time Zone.

### Current State

CLI stats and screenshot commands accept an Analysis Time Zone override, and the dashboard accepts it through URL view state; otherwise they use the user's time zone. The Daily Report command uses the user's time zone without an override.

### Rationale

Analysis should follow the user's working calendar.

## ADR-002: Do Not Persist Usage Data

### Decision

Do not persist usage data.

### Current State

Imported CSV data and computed analysis results are processed in memory without application-managed history storage. Users can explicitly export analysis as JSON or PNG.

### Rationale

Retained usage histories can expose users’ activity and spending.

## ADR-003: Do Not Treat cursor-usage as a Billing Audit Tool

### Decision

Analyze reported usage trends and costs without auditing billing.

### Current State

Spend uses the CSV `Cost` column; reconstructed pricing, invoice reconciliation, and accounting are out of scope.

### Rationale

Reported usage supports trend analysis without establishing billing correctness.

## ADR-004: Treat URLs as View State, Not Data Sharing

### Decision

Encode analysis view state in URLs without including Usage Export data.

### Current State

Links preserve view selections and Daily Window boundaries, require recipients to load the same export, and follow ADR-011 for legacy Metric compatibility.

### Rationale

A shared view should reproduce the same analysis boundaries while keeping usage data local.

## ADR-005: Build Analysis on a CLI-First Foundation

### Decision

Design and implement analysis for CLI execution first; the dashboard consumes the same analysis logic.

### Current State

Shared analysis logic is independent of the browser, with CLI and dashboard serving as interfaces.

### Rationale

Analysis must remain executable and reproducible without a UI.

## ADR-006: Use Daily Windows Instead of Calendar Days

### Decision

Use Daily Windows starting at a selected hour for one-day analysis.

### Current State

CLI stats and screenshot commands and dashboard URL view state support a selected Daily Window start hour. The Daily Report command uses a fixed early-morning start and selects the latest Daily Window containing Billable Events.

### Rationale

Work sessions can continue past midnight.

## ADR-007: Group Model Charts by Model Family, with Auto as One Router-Level Family

### Decision

Group Model charts by Model Family and all Auto routing usage into one `Auto` family.

### Current State

Charts group Models according to the Model Family and Auto definitions in CONTEXT.md. CLI detail views and JSON preserve original Model identifiers; dashboard event tables display Fast Mode as an Event Label separately from the Model name.

### Rationale

Family grouping keeps charts readable despite variant proliferation and changing Router names.

## ADR-008: Colocate Unit Tests with Implementation

### Decision

Use colocation: place unit tests beside the implementation they verify.

### Current State

Unit tests share their target module’s directory; tests spanning multiple modules live in `tests/`.

### Rationale

Keeping tests with their implementation makes them easier to find and maintain together.

## ADR-009: Rank and Display CLI Analysis by a Selected Metric

### Decision

Let CLI analysis select Spend or Tokens as its primary Metric.

### Current State

`stats --metric cost|tokens` controls ranking and primary display, defaulting to Spend; dashboard behavior follows ADR-011.

### Rationale

Tokens distinguish usage volume from reported Spend.

## ADR-010: Period Charts Show Missing Daily Windows as Zero

### Decision

Render missing time intervals as zero in period displays.

### Current State

Period series fill missing Daily Windows between the first and last active windows and missing Hours within each window with zeros; rankings, summaries, and averages use active windows, and category breakdowns stay sparse.

### Rationale

Omitting idle intervals makes discontinuous activity look continuous.

## ADR-011: Show Spend and Tokens Together for Sharing

### Decision

Show both Metrics simultaneously in dashboard views and screenshots.

### Current State

Dashboard views expose both Metrics together; legacy Metric parameters remain compatible without hiding either Metric.

### Rationale

One screenshot should communicate both reported Spend and usage volume.

## ADR-012: Rank Users by Aggregate Effective Rate

### Decision

Rank Users by aggregate reported Spend per million tokens, with independent ordering for each User ranking.

### Current State

Effective Rate uses the aggregate definition in CONTEXT.md and excludes zero unrounded Spend or Tokens without a minimum-volume threshold; selecting a User preserves the full ranking comparison set.

### Rationale

Aggregate Effective Rate reveals reported unit-cost differences caused by Model and cache mix, not productivity or quality.

## ADR-013: Compare Cloud Agent Adoption by User

### Decision

Compare Cloud Agent adoption by the proportion of each User’s usage events that involve Cloud Agent.

### Current State

Usage Rate is the number of Billable Events with a Cloud Agent ID divided by that User’s total Billable Events.

### Rationale

Event proportions show adoption without being distorted by model prices or token volume.

## ADR-014: Hide Spend When Sharing Usage

### Decision

Let users hide total and event-level Spend when sharing usage analysis.

### Current State

The dashboard and screenshot exports can hide total and event-level Spend while calculations continue to use the original values. Averages and Effective Rate remain visible.

### Rationale

Users can share usage trends without displaying total or event-level spending.

## ADR-016: Analyze Usage by Cloud Agent ID

### Decision

Aggregate Billable Events by Cloud Agent ID within the selected analysis period and filters.

### Current State

Events sharing an ID are combined across Users and Daily Windows to calculate Spend, Tokens, and Event Count for that ID.

### Rationale

Per-ID totals make each Cloud Agent’s usage visible.

## ADR-018: Prefer Official Cursor Terminology

### Decision

Match official Cursor terminology wherever possible; translation rules belong to CONTEXT.md.

### Current State

CLI metric labels use Spend / Tokens; dashboard labels follow CONTEXT.md in the selected display language, including 支出 / トークン and 実行単価 in Japanese.

### Rationale

Familiar terms reduce the effort of learning cursor-usage.

## ADR-019: Deliver Value Beyond Cursor's Official Usage Screen

### Decision

Provide quality and value beyond Cursor's official usage screen.

### Current State

The tool provides CLI analysis, Daily Windows with configurable boundaries, shareable dashboard images with Spend hiding, and analysis by Cloud Agent ID.

### Rationale

cursor-usage needs a reason to be chosen over the official screen.

## ADR-020: Support Japanese and English Display Languages

### Decision

Support Japanese and English display languages in the dashboard and screenshot exports, independently of analysis settings.

### Current State

The dashboard uses a saved explicit language choice or the first supported browser-preferred language, falling back to English. Only the language preference is persisted; switching languages preserves the loaded data and view selections. Screenshot and Daily Report commands accept `--lang ja|en` and otherwise use the environment's language, falling back to English. CLI help and terminal statistics remain in English.

### Rationale

Users need to read and share the same analysis in their preferred language.

## ADR-021: Remove Confidential Information from CSV Through the CLI

### Decision

Provide a CLI tool that removes confidential information from a Usage Export by replacing email addresses and agent/automation IDs and perturbing Spend and Tokens while retaining approximate usage patterns.

### Current State

- Replace User email addresses with common Japanese surnames in Roman letters, such as `sato@example.jp` and `suzuki@example.jp`; append numeric suffixes such as `sato1`, `sato2`, and `sato3` when the surname pool is exhausted so that thousands of Users remain distinct.
- Keep replacements consistent within a conversion: the same original email maps to the same replacement, and different Users receive different addresses.
- Replace original domains consistently with distinct example domains, starting with `example.jp` and using different suffixes such as `example.com`, `example.dev`, and `example.net` for additional domains; preserve domain grouping without retaining original domain names.
- Replace nonempty Cloud Agent IDs and Automation IDs with new random UUIDs, retaining the `bc-` prefix where present; keep repeated IDs mapped consistently within a conversion and different IDs distinct.
- Perturb Spend and token counts with random multipliers close to one, such as 0.9–1.1, to retain approximate magnitudes while changing the reported values; round Spend to two decimal places using the same method as display formatting, truncate fractional token counts, and keep zero values at zero.

### Rationale

Users need to remove original email addresses, organization domains, agent/automation IDs, and exact Spend and token counts from CSV data while preserving its usefulness for usage analysis.
