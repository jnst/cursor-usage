# Domain Language

This context defines how Cursor usage-events CSV exports are interpreted for cost and usage analysis.

English headings are canonical terms. Use the heading in English UI and the `Japanese` label in Japanese UI; every term must include a `Japanese` field. `Same as English` means the English heading is used unchanged in Japanese UI. Keep definitions in English only. CSV column names, CLI options, JSON keys, and other identifiers are not translated. This file owns domain terminology and naming rules, not screen-specific copy.

## Active Daily Window

Japanese: アクティブ日次ウィンドウ

A Daily Window with at least one Billable Event.
Avoid: Active Day

## Analysis Axis

Japanese: 分析軸

A dimension used to group Usage Events for analysis, such as Daily Window, Hour, User, Model, or Kind.

## Analysis Time Zone

Japanese: 分析タイムゾーン

The time zone used to group Usage Events into Daily Windows and Hours for analysis. The default comes from the user's environment, and users may override it for a specific analysis.

## Auto (Cursor Router)

Japanese: Same as English

Cursor's model router. Usage Exports report Auto usage as an `auto` Model identifier, an `auto-smart` Model identifier (the Router's internal model id, recorded for Auto usage via the SDK/API and JetBrains ACP sessions), a standalone Router mode name (`Auto Balanced` or `Auto Intelligence`), or a routed display name such as `Opus 5 (Auto Balanced)`, where the parenthesized part names the Router mode and the leading part names the routed Model. All these shapes belong to the `Auto` Model Family.
Avoid: Auto Mode Family per Router mode

## Avg Daily Cost

Japanese: 平均日次コスト

Total Cost divided by the number of Active Daily Windows in the analysis set. "Daily" here means Daily Window, not a calendar day.
Avoid: Avg Cost / Active Daily Window, Avg Cost / Active Day, Avg Cost / Day

## Avg Daily Token Count

Japanese: 平均日次トークン使用量

Total Token Count divided by the number of Active Daily Windows in the analysis set. Shown when Selected Metric is Token Count.
Avoid: Avg Token Count / Active Daily Window, Avg Token Count / Day

## Billable Event

Japanese: 課金イベント

A Usage Event that is included in normal cost and usage analysis. Billable Events exclude No Charge Events.

Normal analysis uses Billable Events by default.

## Cloud Agent Usage Rate

Japanese: Cloud Agent使用率

The percentage of a User's Billable Events whose `Cloud Agent ID` is nonempty. Each Usage Event counts once, even when the same ID repeats. No Charge Events are excluded from numerator and denominator. This measures event share, not Cost or Token Count share.

## Cloud Agent ID Group

Japanese: Cloud Agent IDグループ

Billable Events sharing a trimmed, nonempty Cloud Agent ID within the current analysis scope. One group can span multiple Users and Daily Windows. It does not establish a completed task or agent lifetime; first and last observations are event timestamps, not runtime.

## Cost

Japanese: コスト

The USD amount reported by the `Cost` column in Cursor's usage-events CSV export. Cost is not recalculated from token counts and model prices.

## Daily Report

Japanese: 日次レポート

A shareable dashboard view for one Daily Window. Daily Reports are optimized to show when usage happened and what drove Cost.

## Daily Window

Japanese: 日次ウィンドウ

A 24-hour analysis window that starts at a selected hour in the Analysis Time Zone. Daily Windows are used when users want to describe a work session that may continue past midnight.
Avoid: Day

## Daily Window Key

Japanese: 日次ウィンドウキー

The `YYYY-MM-DD` label for a Daily Window, based on the local date at the window start in the Analysis Time Zone.
Avoid: Day

## Daily Window Range

Japanese: 日次ウィンドウ範囲

The range from the first Active Daily Window to the last Active Daily Window in the analysis set. Period charts render every Daily Window in this range; Daily Windows with no Usage Export rows display as zero. Rankings, summaries, and averages still use Active Daily Windows only.
Avoid: Calendar Range

## Effective Rate

Japanese: 実行単価

Reported Cost per million tokens (`Cost / Token Count * 1,000,000`) over the current analysis set or Daily Window. Displayed as `$x.xx / MTok`. Effective Rate is a diagnostic for cheap versus expensive usage, not a reconstructed model price. When Token Count is 0, Effective Rate is undefined and renders as an em dash.
Avoid: Unit Price, Model Price, Free Tier

## Event Label

Japanese: イベントラベル

A display-only annotation on a Usage Event in event tables. Event Labels are not an Analysis Axis and not a Metric.

There are four Event Labels:

1. **Cloud Agent** — when `Cloud Agent ID` is present
2. **Automation** — when `Automation ID` is present
3. **Max Mode** — when the legacy `Max Mode` column is `Yes`
4. **Fast Mode** — when the Model identifier includes the `fast` suffix. The event table shows that suffix as this label, not as part of the Model name.

Avoid: Model Mark, treating an Event Label as an Analysis Axis or Metric

## High Cost

Japanese: 高コスト

A relative description for Daily Windows or Billable Events with large Cost within the current analysis set.
Avoid: Fixed Cost Threshold

## Hour

Japanese: 時間帯

An hour of a Daily Window in the Analysis Time Zone.

## Kind

Japanese: 種別

The event classification reported by the `Kind` column in Cursor's usage-events CSV export. Kind is an analysis axis.
Avoid: Status, Type

## Max Mode

Japanese: Same as English

A legacy `Max Mode` column in older usage-events CSV exports. Current Usage Exports typically do not populate it, so Max Mode is not an analysis Metric and is not shown in summaries. The column is still parsed when present. When the column is `Yes`, Max Mode may also appear as an Event Label.
Avoid: High-Cost Mode, Max Mode Ratio

## Metric

Japanese: 指標

An analysis value obtained from or calculated over Usage Events, such as Cost, Token Count, Event Count, or Effective Rate.
Avoid: Summary, Bucket

## Model

Japanese: モデル

The model identifier reported by the `Model` column in Cursor's usage-events CSV export. Model is the event-level identifier; charts group Models into Model Families.
Avoid: Provider

## Model Family

Japanese: モデルファミリー

An analysis grouping of Models that differ only by Variant Attributes. Usage routed through Auto (Cursor Router) belongs to the `Auto` Model Family regardless of Router mode or routed Model; the routed Models stay visible in Model-level detail views.
Avoid: Model Group, Base Model

## MTok

Japanese: Same as English

A compact display unit meaning one million tokens. Used when showing Effective Rate (`$ / MTok`).
Avoid: MT, M tokens

## No Charge Event

Japanese: 非課金イベント

A Usage Event whose `Kind` is `Errored, No Charge`. No Charge Events are parsed from the CSV but excluded from normal cost and usage analysis.

No Charge Events may be included only when explicitly requested.

## Selected Metric

Japanese: 選択指標

The Metric the CLI ranks and displays as its primary value, either Cost or Token Count. The default is Cost. The dashboard displays both simultaneously (ADR-011). Selected Metric is an analysis choice, like Analysis Time Zone and Daily Window start hour: it does not change which Usage Events are included.
Avoid: Chart scale, Display Metric

## Token Count

Japanese: トークン使用量

A usage volume measure reported by the token columns in Cursor's usage-events CSV export. Token Counts explain usage shape but are not the source of truth for Cost.

## Usage Event

Japanese: 利用イベント

A single row from Cursor's usage-events CSV export. Usage Events include both charged usage and no-charge rows.

## Usage Export

Japanese: 利用履歴エクスポート

Cursor's usage-events CSV export. Usage Export is the official input data for cursor-usage.

## User

Japanese: ユーザー

The user identifier reported by the `User` column in Cursor's usage-events CSV export.
Avoid: Account, Member

## Variant Attribute

Japanese: バリアント属性

A Model identifier suffix that does not change the Model Family. There are exactly three axes:

1. **Reasoning effort** — `high`, `xhigh`, `medium`, `low`, or `max`
2. **Thinking** — present or absent (`thinking`)
3. **Fast mode** — present or absent (`fast`)

Suffix order varies between Usage Exports (`-thinking-high` vs `-high-thinking`); all three axes may combine on one Model. Variant Attributes are distinct from Auto (Cursor Router) naming. The `max` reasoning-effort suffix is a Variant Attribute, not the legacy Max Mode column.
Avoid: Model Variant as a separate analysis axis
