import { describe, expect, it } from "bun:test";

import { en, translator, type MessageKey } from "./messages.ts";

describe("dashboard translations", () => {
  it("keeps all interpolation fields in both languages", () => {
    const fields = (value: string) => [...value.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const key of Object.keys(en) as MessageKey[]) {
      expect(fields(translator("ja")(key))).toEqual(fields(en[key]));
    }
  });
  it("translates glossary terms and preserves interpolated data literally", () => {
    expect(translator("ja")("Effective Rate")).toBe("実行単価");
    expect(translator("ja")("Spend")).toBe("支出");
    expect(translator("en")("Tokens")).toBe("Tokens");
    const user = "日本語 <admin> $& {count}";
    expect(translator("en")("selectedUser", { user })).toBe(`Selected User: ${user}`);
    expect(translator("ja")("selectedUser", { user })).toBe(`選択中のユーザー: ${user}`);
  });
});
