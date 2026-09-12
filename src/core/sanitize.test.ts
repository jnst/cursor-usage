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

  it("preserves missing Cost markers in Included events while sanitizing other values", () => {
    const input = [
      "Date,User,Cloud Agent ID,Automation ID,Kind,Model,Max Mode,Input (w/ Cache Write),Input (w/o Cache Write),Cache Read,Output Tokens,Total Tokens,Cost",
      '"2026-08-28T23:59:15.656Z","first@company.invalid","","","Included","Cursor Grok 4.6 (Auto Balanced)","No","0","110775","471552","21213","603540","-"',
      '"2026-08-28T23:14:54.110Z","second@company.invalid","","","Included","cursor-grok-4.5-high","No","0","2090","48512","134","50736","-"',
      '"2026-08-28T23:14:30.155Z","second@company.invalid","","","Included","cursor-grok-4.5-high","No","0","7719","40832","1087","49638","-"',
    ].join("\n");
    const output = sanitizeCsv(input, () => 0);
    const rows = parseCsv(output).slice(1);
    expect(rows.map((row) => row[12])).toEqual(["-", "-", "-"]);
    expect(rows.map((row) => row[1])).toEqual([
      "sato@example.jp",
      "suzuki@example.jp",
      "suzuki@example.jp",
    ]);
    expect(rows[0]![11]).toBe("543186");
    expect(parseUsageCsv(output)).toHaveLength(3);
    expect(parseUsageCsv(output).every((event) => event.cost === 0)).toBe(true);
    expect(() => sanitizeCsv("User,Output Tokens\na@company.invalid,-")).toThrow();
  });

  it("preserves Free Cost and empty token fields while replacing the User", () => {
    const input = [
      "Date,User,Cloud Agent ID,Automation ID,Kind,Model,Max Mode,Input (w/ Cache Write),Input (w/o Cache Write),Cache Read,Output Tokens,Total Tokens,Cost",
      '"2026-08-28T16:36:00.131Z","user@company.invalid","","","On-Demand","gpt-5.6-sol-medium","No","","","","","","Free"',
    ].join("\n");
    const output = sanitizeCsv(input);
    const row = parseCsv(output)[1]!;
    expect(row[1]).toBe("sato@example.jp");
    expect(row.slice(7)).toEqual(["", "", "", "", "", "Free"]);
    expect(parseUsageCsv(output)[0]!.cost).toBe(0);
    expect(() => sanitizeCsv("User,Output Tokens\na@company.invalid,Free")).toThrow();
  });

  it("preserves N/A Users without consuming aliases and still perturbs their metrics", () => {
    const input = [
      "Date,User,Cloud Agent ID,Automation ID,Kind,Model,Max Mode,Input (w/ Cache Write),Input (w/o Cache Write),Cache Read,Output Tokens,Total Tokens,Cost",
      '"2026-08-28T14:56:02.163Z","N/A","bc-test","automation-test","On-Demand","composer-2.5","No","0","81526","719600","4304","805430","0.20"',
      '"2026-08-28T14:57:02.163Z","person@company.invalid","","","Included","composer-2.5","No","0","100","0","0","100","-"',
    ].join("\n");
    const rows = parseCsv(sanitizeCsv(input, () => 0));
    expect(rows[1]![1]).toBe("N/A");
    expect(rows[1]!.slice(2, 4)).toEqual(["bc-test", "automation-test"]);
    expect(rows[1]!.slice(11)).toEqual(["724887", "0"]);
    expect(rows[2]![1]).toBe("sato@example.jp");
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
