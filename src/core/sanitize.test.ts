import { describe, expect, it } from "bun:test";

import { parseCsv, parseUsageCsv } from "./parse.ts";
import { sanitizeCsv } from "./sanitize.ts";

describe("sanitizeCsv", () => {
  it("keeps repeated Users and domain groups consistent without alias collisions at scale", () => {
    const emails = Array.from({ length: 5000 }, (_, i) => `private${i}@company${i % 7}.invalid`);
    const csv = sanitizeCsv(
      ["User,Cost", ...emails.map((email) => `${email},10`), `${emails[0]},10`].join("\n"),
    );
    const rows = parseCsv(csv).slice(1);
    expect(new Set(rows.slice(0, 5000).map((row) => row[0])).size).toBe(5000);
    expect(rows[5000]![0]).toBe(rows[0]![0]);
    expect(rows[0]![0]).toBe("sato@example.jp");
    expect(rows[20]![0]).toStartWith("sato1@");
    expect(new Set(rows.slice(0, 5000).map((row) => row[0]!.split("@")[1])).size).toBe(7);
    expect(rows[7]![0]!.split("@")[1]).toBe("example.jp");
    expect(csv).not.toContain("private");
    expect(csv).not.toContain("company");
  });

  it("perturbs every metric and truncates fractions, including Spend", () => {
    const csv =
      "User,Cost,Input (w/ Cache Write),Input (w/o Cache Write),Cache Read,Output Tokens,Total Tokens\na@b.invalid,12.9,101,0,23,7,131";
    const low = parseCsv(sanitizeCsv(csv, () => 0))[1]!;
    const high = parseCsv(sanitizeCsv(csv, () => 1))[1]!;
    expect(low.slice(1)).toEqual(["11", "90", "0", "20", "6", "117"]);
    expect(high.slice(1)).toEqual(["14", "111", "0", "25", "7", "144"]);
    expect(parseCsv(sanitizeCsv("User,Cost\na@b.invalid,0.09", () => 0.5))[1]![1]).toBe("0");
  });

  it("preserves quoted metadata, row order, and compatibility with analysis", () => {
    const input =
      '\uFEFFDate,User,Model,Cost,Kind,Cloud Agent ID,Automation ID,Notes\r\n2026-09-11T00:00:00Z,a@company.invalid,m,5,"Errored, No Charge",agent,automation,"a ""quote""\nand comma, here"\r\n';
    const output = sanitizeCsv(input, () => 0.5);
    const event = parseUsageCsv(output)[0]!;
    expect(event.user).toBe("sato@example.jp");
    expect(event.cost).toBe(5);
    expect(event.kind).toBe("Errored, No Charge");
    expect(event.cloudAgentId).toBe("agent");
    expect(parseCsv(output)[1]![7]).toBe('a "quote"\nand comma, here');
  });

  it("preserves blank fields and handles header-only exports", () => {
    expect(sanitizeCsv("User,Cost\n,\n")).toBe("User,Cost\n,\n");
    expect(sanitizeCsv("User,Cost\n")).toBe("User,Cost\n");
  });

  it("rejects malformed CSV and invalid target fields without echoing secrets", () => {
    for (const input of [
      "",
      "Other\nx",
      "User,User\na,b",
      'User,Cost\n"secret,1',
      'User,Cost\n"secret"bad,1',
      "User,Cost\nsecret,1",
      "User,Cost\na@b.invalid,secret",
      "User,Cost\na@b.invalid,-1",
      "User,Cost\na@b.invalid,Infinity",
      "User,Cost\na@b.invalid,1,2",
    ]) {
      let error: unknown;
      try {
        sanitizeCsv(input);
      } catch (caught) {
        error = caught;
      }
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).not.toContain("secret");
    }
  });
});
