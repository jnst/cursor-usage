import { parseCsv } from "./parse.ts";

const SURNAMES = [
  "sato",
  "suzuki",
  "takahashi",
  "tanaka",
  "watanabe",
  "ito",
  "yamamoto",
  "nakamura",
  "kobayashi",
  "kato",
  "yoshida",
  "yamada",
  "sasaki",
  "yamaguchi",
  "matsumoto",
  "inoue",
  "kimura",
  "hayashi",
  "shimizu",
  "saito",
];
const DOMAINS = ["example.jp", "example.com", "example.dev", "example.net"];
const NUMERIC_COLUMNS = new Set([
  "Cost",
  "Input (w/ Cache Write)",
  "Input (w/o Cache Write)",
  "Cache Read",
  "Output Tokens",
  "Total Tokens",
]);

function quote(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

/** Replacements live only for this conversion; unrelated columns retain their values. */
export function sanitizeCsv(text: string, random: () => number = Math.random): string {
  const rows = parseCsv(text.replace(/^\uFEFF/, ""), true);
  const header = rows[0];
  if (!header) throw new Error("Invalid CSV: empty input");
  const columns = header.map((name) => name.trim());
  if (new Set(columns).size !== columns.length) {
    throw new Error("Invalid CSV: duplicate columns");
  }
  const userIndex = columns.indexOf("User");
  if (userIndex < 0) throw new Error('Invalid CSV: missing column "User"');
  const users = new Map<string, string>();
  const domains = new Map<string, string>();
  const output = [header];

  for (const [index, row] of rows.slice(1).entries()) {
    if (row.length === 1 && row[0] === "") continue;
    if (row.length !== header.length) {
      throw new Error(`Invalid CSV: unexpected field count at row ${index + 2}`);
    }
    output.push(
      row.map((value, column) => {
        if (column === userIndex) {
          const email = value.trim();
          if (!email) return "";
          const match = /^[^\s@]+@([^\s@]+)$/.exec(email);
          if (!match) throw new Error(`Invalid CSV: invalid User email at row ${index + 2}`);
          let replacement = users.get(email);
          if (!replacement) {
            const originalDomain = match[1]!.toLowerCase();
            let domain = domains.get(originalDomain);
            if (!domain) {
              domain =
                DOMAINS[domains.size] ?? `team${domains.size - DOMAINS.length + 1}.example.net`;
              domains.set(originalDomain, domain);
            }
            const suffix = Math.floor(users.size / SURNAMES.length);
            replacement = `${SURNAMES[users.size % SURNAMES.length]}${suffix || ""}@${domain}`;
            users.set(email, replacement);
          }
          return replacement;
        }
        if (!NUMERIC_COLUMNS.has(columns[column]!)) return value;
        if (!value.trim()) return value;
        const number = Number(value);
        if (!Number.isFinite(number) || number < 0) {
          throw new Error(
            `Invalid CSV: invalid numeric value at row ${index + 2}, column ${column + 1}`,
          );
        }
        const result = Math.trunc(number * (0.9 + random() * 0.2));
        if (!Number.isSafeInteger(result)) {
          throw new Error(
            `Invalid CSV: numeric value out of range at row ${index + 2}, column ${column + 1}`,
          );
        }
        return String(result);
      }),
    );
  }
  return `${output.map((row) => row.map(quote).join(",")).join("\n")}\n`;
}
