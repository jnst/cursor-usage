# Cursor Usage Analysis

This context describes how Cursor usage-events CSV exports are interpreted for cost and usage analysis.

## Language

**Usage Export**:
Cursor's usage-events CSV export. Usage Export is the official input data for cursor-usage.

**Usage Event**:
A single row from Cursor's usage-events CSV export. Usage Events include both charged usage and no-charge rows.

**Billable Event**:
A Usage Event that is included in normal cost and usage analysis. Billable Events exclude No Charge Events.

Normal analysis uses Billable Events by default.

**No Charge Event**:
A Usage Event whose `Kind` is `Errored, No Charge`. No Charge Events are parsed from the CSV but excluded from normal cost and usage analysis.

No Charge Events may be included only when explicitly requested.

**Analysis Time Zone**:
The time zone used to group Usage Events into Days and Hours for analysis. The default comes from the user's environment, and users may override it for a specific analysis.

**Day**:
A calendar day in the Analysis Time Zone. Day boundaries are not inherently UTC boundaries.

**Active Day**:
A Day with at least one Billable Event.

**Date Range**:
The range from the first Active Day to the last Active Day in the analysis set.
_Avoid_: Calendar Range

**Hour**:
An hour of a Day in the Analysis Time Zone.

**Analysis Axis**:
A dimension used to group Usage Events for analysis, such as Day, Hour, User, Model, or Kind.

**Metric**:
An analysis value obtained from or calculated over Usage Events, such as Cost, Token Count, Event Count, or Max Mode Ratio.
_Avoid_: Summary, Bucket

**Max Mode**:
The Cursor usage mode reported by the `Max Mode` column in Cursor's usage-events CSV export.
_Avoid_: High-Cost Mode

**Max Mode Ratio**:
The share of analyzed Billable Events where Max Mode is enabled.

**Cost**:
The USD amount reported by the `Cost` column in Cursor's usage-events CSV export. Cost is not recalculated from token counts and model prices.

**Avg Cost / Active Day**:
Total Cost divided by the number of Active Days in the analysis set.
_Avoid_: Avg Cost / Day

**High Cost**:
A relative description for Days or Billable Events with large Cost within the current analysis set.
_Avoid_: Fixed Cost Threshold

**Token Count**:
A usage volume measure reported by the token columns in Cursor's usage-events CSV export. Token Counts explain usage shape but are not the source of truth for Cost.

**User**:
The user identifier reported by the `User` column in Cursor's usage-events CSV export.
_Avoid_: Account, Member

**Model**:
The model identifier reported by the `Model` column in Cursor's usage-events CSV export.
_Avoid_: Model Family, Provider

**Kind**:
The event classification reported by the `Kind` column in Cursor's usage-events CSV export. Kind is an analysis axis.
_Avoid_: Status, Type
