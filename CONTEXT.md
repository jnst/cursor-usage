# Cursor Usage Analysis

This context describes how Cursor usage-events CSV exports are interpreted for cost and usage analysis.

## Language

**Active Daily Window**:
A Daily Window with at least one Billable Event.
_Avoid_: Active Day

**Analysis Axis**:
A dimension used to group Usage Events for analysis, such as Daily Window, Hour, User, Model, or Kind.

**Analysis Time Zone**:
The time zone used to group Usage Events into Daily Windows and Hours for analysis. The default comes from the user's environment, and users may override it for a specific analysis.

**Auto (Cursor Router)**:
Cursor's model router. Usage Exports report Auto usage in three shapes: an `auto` Model identifier, an `auto-smart` Model identifier (the Router's internal model id, recorded for Auto usage via the SDK/API and JetBrains ACP sessions), or a routed display name such as `Opus 5 (Auto Balanced)`, where the parenthesized part names the Router mode and the leading part names the routed Model. All three shapes belong to the `Auto` Model Family.
_Avoid_: Auto Mode Family per Router mode

**Avg Cost / Active Daily Window**:
Total Cost divided by the number of Active Daily Windows in the analysis set.
_Avoid_: Avg Cost / Active Day, Avg Cost / Day

**Billable Event**:
A Usage Event that is included in normal cost and usage analysis. Billable Events exclude No Charge Events.

Normal analysis uses Billable Events by default.

**Cost**:
The USD amount reported by the `Cost` column in Cursor's usage-events CSV export. Cost is not recalculated from token counts and model prices.

**Daily Report**:
A shareable dashboard view for one Daily Window. Daily Reports are optimized to show when usage happened and what drove Cost.

**Daily Window**:
A 24-hour analysis window that starts at a selected hour in the Analysis Time Zone. Daily Windows are used when users want to describe a work session that may continue past midnight.
_Avoid_: Day

**Daily Window Key**:
The `YYYY-MM-DD` label for a Daily Window, based on the local date at the window start in the Analysis Time Zone.
_Avoid_: Day

**Daily Window Range**:
The range from the first Active Daily Window to the last Active Daily Window in the analysis set.
_Avoid_: Calendar Range

**Effective Rate**:
Reported Cost per million tokens (`Cost / Token Count * 1,000,000`) over the current analysis set or Daily Window. Displayed as `$x.xx / MTok`. Effective Rate is a diagnostic for cheap versus expensive usage, not a reconstructed model price. When Token Count is 0, Effective Rate is undefined and renders as an em dash.
_Avoid_: Unit Price, Model Price, Free Tier

**High Cost**:
A relative description for Daily Windows or Billable Events with large Cost within the current analysis set.
_Avoid_: Fixed Cost Threshold

**Hour**:
An hour of a Daily Window in the Analysis Time Zone.

**Kind**:
The event classification reported by the `Kind` column in Cursor's usage-events CSV export. Kind is an analysis axis.
_Avoid_: Status, Type

**Max Mode**:
A legacy `Max Mode` column in older usage-events CSV exports. Current Usage Exports typically do not populate it, so Max Mode is not an analysis Metric and is not shown in summaries. The column is still parsed when present.
_Avoid_: High-Cost Mode, Max Mode Ratio

**Metric**:
An analysis value obtained from or calculated over Usage Events, such as Cost, Token Count, Event Count, or Effective Rate.
_Avoid_: Summary, Bucket

**Model**:
The model identifier reported by the `Model` column in Cursor's usage-events CSV export. Model is the event-level identifier; charts group Models into Model Families.
_Avoid_: Provider

**Model Family**:
An analysis grouping of Models that differ only by Variant Attributes. Usage routed through Auto (Cursor Router) belongs to the `Auto` Model Family regardless of Router mode or routed Model; the routed Models stay visible in Model-level detail views.
_Avoid_: Model Group, Base Model

**MTok**:
A compact display unit meaning one million tokens. Used when showing Effective Rate (`$ / MTok`).
_Avoid_: MT, M tokens

**No Charge Event**:
A Usage Event whose `Kind` is `Errored, No Charge`. No Charge Events are parsed from the CSV but excluded from normal cost and usage analysis.

No Charge Events may be included only when explicitly requested.

**Selected Metric**:
The Metric this analysis ranks and displays as its primary value, either Cost or Token Count. The default is Cost. Selected Metric is an analysis choice, like Analysis Time Zone and Daily Window start hour: it does not change which Usage Events are included.
_Avoid_: Chart scale, Display Metric

**Token Count**:
A usage volume measure reported by the token columns in Cursor's usage-events CSV export. Token Counts explain usage shape but are not the source of truth for Cost.

**Usage Event**:
A single row from Cursor's usage-events CSV export. Usage Events include both charged usage and no-charge rows.

**Usage Export**:
Cursor's usage-events CSV export. Usage Export is the official input data for cursor-usage.

**User**:
The user identifier reported by the `User` column in Cursor's usage-events CSV export.
_Avoid_: Account, Member

**Variant Attribute**:
A Model identifier suffix that does not change the Model Family. There are exactly three axes:

1. **Reasoning effort** — `high`, `xhigh`, `medium`, `low`, or `max`
2. **Thinking** — present or absent (`thinking`)
3. **Fast mode** — present or absent (`fast`)

Suffix order varies between Usage Exports (`-thinking-high` vs `-high-thinking`); all three axes may combine on one Model. Variant Attributes are distinct from Auto (Cursor Router) naming. The `max` reasoning-effort suffix is a Variant Attribute, not the legacy Max Mode column.
_Avoid_: Model Variant as a separate analysis axis
