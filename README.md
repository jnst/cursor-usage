# cursor-usage

Visualize the usage events CSV exported from the Cursor dashboard.

- **Terminal**: summary and bar charts right in your terminal
- **Dashboard**: a local web dashboard — just drag & drop your CSV

![Dashboard](docs/dashboard.png)

Runs on Node.js 20+ (`npx`) or [Bun](https://bun.sh) (`bunx`).

## Usage

### Dashboard (default)

```bash
npx @jnst/cursor-usage   # or: bunx @jnst/cursor-usage
```

Starts a local server and opens your browser. Drag & drop a CSV exported from Cursor onto the page. All data is processed in the browser and never sent anywhere.

Click any bar in the Daily Window cost chart to drill into that window (hourly breakdown, per-model / per-user / per-kind costs, and every event in the window). Click a user bar to filter the current analysis to that User; the selected User remains visible while other users are dimmed, and clicking the selected user again clears the filter. The selected Daily Window, user, and analysis time zone are reflected in the URL hash (`#daily-window=YYYY-MM-DD&user=jnst%40example.jp&timezone=Asia%2FTokyo`), so the browser back button and shareable links work after loading the same CSV.

The default port is 4321; if it is already in use, a free port is picked automatically. When `--port` is specified explicitly, that port is used as-is.

```bash
npx @jnst/cursor-usage serve --port 8080 --no-open
```

### Terminal stats

```bash
npx @jnst/cursor-usage stats team-usage-events.csv
```

```
Cursor Usage  2026-06-01 – 2026-06-10  (610 events, 10 daily windows)

  Total Cost    $1446.69      Total Tokens  1.1B
  Avg/Active    $144.67       Max Mode      96%
  Users         4             Models        8

Daily Window Cost
  2026-06-01  $147.44  ████████████████▊            10% 102.9M tok, 68 ev
  2026-06-02  $246.57  ████████████████████████████ 17% 180.0M tok, 79 ev
  ...

By Model
  gpt-5.5-medium                 $954.95  ████████████████████████████ 66% 804.2M tok, 472 ev
  claude-opus-4-8-thinking-high  $357.92  ██████████▌                  25% 135.5M tok, 69 ev
  ...
```

Options:

| Option                             | Description                                                    |
| ---------------------------------- | -------------------------------------------------------------- |
| `--by <daily-window\|user\|model>` | Show a single breakdown axis                                   |
| `--daily-window <YYYY-MM-DD>`      | Drill into a single Daily Window                               |
| `--start-hour <0-23>`              | Daily Window start hour (default: `0`)                         |
| `--user <identifier>`              | Filter analysis to a single User                               |
| `--timezone <iana-tz>`             | Group Daily Windows and hours in a specific analysis time zone |
| `--json`                           | Output aggregated stats as JSON (pipe to jq etc.)              |
| `--include-no-charge`              | Include "Errored, No Charge" events                            |

```bash
# Extract key numbers
npx @jnst/cursor-usage stats usage.csv --json | jq .summary.totalCost

# Drill into a Daily Window
npx @jnst/cursor-usage stats usage.csv --daily-window 2026-06-02 --timezone Asia/Tokyo

# Filter to a single user
npx @jnst/cursor-usage stats usage.csv --user jnst@example.jp
```

Or install globally to use the short `cursor-usage` command:

```bash
npm install -g @jnst/cursor-usage   # or: bun add -g @jnst/cursor-usage
cursor-usage stats usage.csv
```

### Screenshots

```bash
npx @jnst/cursor-usage screenshot team-usage-events.csv
```

Captures the dashboard as a PNG next to the CSV. The default screenshot is an
Overview:

```text
team-usage-events.csv -> team-usage-events.png
```

Use `--daily-window` to capture the detail view for one Daily Window:

```bash
npx @jnst/cursor-usage screenshot team-usage-events.csv --daily-window 2026-06-14
```

```text
team-usage-events.csv --daily-window 2026-06-14 -> team-usage-events-2026-06-14-daily.png
```

Use `--start-hour` when a Daily Window should start after midnight, and
`--event-limit` to limit the event table in the screenshot:

```bash
npx @jnst/cursor-usage screenshot usage.csv --daily-window 2026-06-14 --start-hour 5 --event-limit 20
```

For a shareable report of the latest work session in the CSV, use
`daily-report`. It captures the latest 5:00-start Daily Window, limits the
event table to the top 10 events by cost, and writes `daily-report.png` in the
current directory:

```bash
npx @jnst/cursor-usage daily-report usage.csv
```

Screenshots use a headless browser and require an installed Chrome/Chromium.
Set `CHROME_PATH` if Chrome is not available on the default channel. Screenshots
can also be filtered the same way as terminal stats:

```bash
npx @jnst/cursor-usage screenshot usage.csv --daily-window 2026-06-14 --user jnst@example.jp --timezone Asia/Tokyo
npx @jnst/cursor-usage screenshot usage.csv --out dashboard.png
```

## Development

Development tooling uses [Bun](https://bun.sh) (runtime code itself is Node-compatible).

```bash
bun install
bun test              # core logic tests
bun run dev           # dev server with hot reload
bun run build         # bundle CLI and dashboard into dist/
bun dist/cli.js stats usage.csv

# Generate a dummy CSV for screenshots
bun scripts/generate-dummy-csv.ts > dummy-usage.csv
```

### Release

The release command verifies, versions, publishes, pushes commits/tags, and creates a
GitHub Release with generated notes:

```bash
bun run release
```

Use `--dry-run` to print mutating steps without running them:

```bash
bun run release --dry-run
```

The release command is safe to rerun after a partial failure. The script checks
the current tag, npm package version, and GitHub Release before each publishing
step:

```bash
# If npm publish, git push, or GitHub Release creation failed midway,
# fix the problem and run the same command again.
bun run release
```

## Architecture

- `src/core/` — CSV parsing and aggregation (pure TS, shared between terminal and browser)
- `src/cli/` — CLI entry point and terminal rendering
- `src/server/` — static file server built on `Bun.serve`
- `web/` — React + Recharts dashboard (bundled at build time)

## License

MIT
