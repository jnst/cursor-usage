import type { UsageEvent } from "./types.ts";

/**
 * Parses CSV text into rows and fields.
 *
 * This is intentionally small but handles the CSV features used by Cursor's
 * Usage Export: quoted fields, embedded commas, escaped quotes, and newlines
 * inside quoted fields.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ",") {
      pushField();
      i++;
      continue;
    }
    if (ch === "\r") {
      i++;
      continue;
    }
    if (ch === "\n") {
      pushRow();
      i++;
      continue;
    }
    field += ch;
    i++;
  }
  if (field.length > 0 || row.length > 0) pushRow();
  return rows;
}

const EXPECTED_COLUMNS = [
  "Date",
  "User",
  "Cloud Agent ID",
  "Automation ID",
  "Kind",
  "Model",
  "Max Mode",
  "Input (w/ Cache Write)",
  "Input (w/o Cache Write)",
  "Cache Read",
  "Output Tokens",
  "Total Tokens",
  "Cost",
] as const;

function toNumber(value: string | undefined): number {
  if (!value) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Parses a Cursor Usage Export into Usage Events.
 *
 * The CSV `Cost` column is treated as the reported Cost; this parser does not
 * attempt to recalculate pricing from token counts or model names.
 */
export function parseUsageCsv(text: string): UsageEvent[] {
  const rows = parseCsv(text.trim());
  if (rows.length === 0) return [];

  const header = rows[0]!;
  const indexOf = new Map<string, number>();
  header.forEach((name, idx) => indexOf.set(name.trim(), idx));

  for (const required of ["Date", "User", "Model", "Cost"]) {
    if (!indexOf.has(required)) {
      throw new Error(
        `Invalid CSV: missing column "${required}". Expected a Cursor usage-events export with columns: ${EXPECTED_COLUMNS.join(", ")}`,
      );
    }
  }

  const col = (row: string[], name: string): string => {
    const idx = indexOf.get(name);
    return idx === undefined ? "" : (row[idx] ?? "").trim();
  };

  const events: UsageEvent[] = [];
  for (const row of rows.slice(1)) {
    if (row.length === 1 && row[0] === "") continue;
    const dateRaw = col(row, "Date");
    const date = new Date(dateRaw);
    if (Number.isNaN(date.getTime())) continue;

    events.push({
      date,
      user: col(row, "User"),
      cloudAgentId: col(row, "Cloud Agent ID") || null,
      automationId: col(row, "Automation ID") || null,
      kind: col(row, "Kind"),
      model: col(row, "Model"),
      maxMode: col(row, "Max Mode").toLowerCase() === "yes",
      inputWithCacheWrite: toNumber(col(row, "Input (w/ Cache Write)")),
      inputWithoutCacheWrite: toNumber(col(row, "Input (w/o Cache Write)")),
      cacheRead: toNumber(col(row, "Cache Read")),
      outputTokens: toNumber(col(row, "Output Tokens")),
      totalTokens: toNumber(col(row, "Total Tokens")),
      cost: toNumber(col(row, "Cost")),
    });
  }
  return events;
}
