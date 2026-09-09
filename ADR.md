# Architecture Decision Records

ADRs record lasting design choices, their reasons, and constraints on future implementation—not a catalog of current behavior.

## Writing Rules

- Keep Decision, Current State, and Rationale to one sentence each by default.
- Record a detail only when changing it would require reconsidering the design decision.
- Keep adjustable UI sizes, layouts, scales, and display counts in implementation, not ADRs.
- Current State shows how the decision applies, not a complete specification; reference code, owning ADRs, or CONTEXT.md for details.

## ADR-001: Use a User-Selectable Analysis Time Zone

### Decision

Group Daily Windows and Hours in a user-selectable Analysis Time Zone.

### Current State

CLI and dashboard default to the user's time zone and allow an override that determines Daily Window and Hour boundaries.

### Rationale

Analysis should follow the user's working calendar.

## ADR-002: Do Not Persist Usage Data

### Decision

Do not persist usage data, to protect users’ information.

### Current State

Imported CSV data and computed analysis results are processed in memory without application-managed storage.

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

General analysis starts at midnight by default; Daily Reports default to the latest exported Daily Window and a 05:00 start, using the Analysis Time Zone from ADR-001.

### Rationale

Work sessions can continue past midnight.

## ADR-007: Group Model Charts by Model Family, with Auto as One Router-Level Family

### Decision

Group Model charts by Model Family and all Auto routing usage into one `Auto` family.

### Current State

Charts use the Model Family and Auto definitions in CONTEXT.md while preserving original Models in event details, drilldown, and JSON.

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

The dashboard and screenshot exports can hide these amounts while calculations continue to use the original values.

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

Metric labels use Spend / Tokens in English and 支出 / トークン in Japanese.

### Rationale

Familiar terms reduce the effort of learning cursor-usage.

## ADR-019: Deliver Value Beyond Cursor's Official Usage Screen

### Decision

Provide quality and value beyond Cursor's official usage screen.

### Current State

Use the official experience as the baseline when evaluating features and UI improvements.

### Rationale

cursor-usage needs a reason to be chosen over the official screen.
