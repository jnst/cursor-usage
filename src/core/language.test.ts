import { describe, expect, it } from "bun:test";

import { preferredLanguage } from "./language.ts";

describe("preferredLanguage", () => {
  it("honors preference order and regional language tags", () => {
    expect(preferredLanguage(["ja-JP", "en-US"])).toBe("ja");
    expect(preferredLanguage(["en-GB", "ja"])).toBe("en");
    expect(preferredLanguage(["fr-FR", "ja-JP", "en"])).toBe("ja");
    expect(preferredLanguage(["JA_jp.UTF-8"])).toBe("ja");
  });
  it("falls back to English for unsupported or absent preferences", () => {
    expect(preferredLanguage(["fr-FR"])).toBe("en");
    expect(preferredLanguage([])).toBe("en");
    expect(preferredLanguage(["C.UTF-8"])).toBe("en");
    expect(preferredLanguage(["japanese", "english"])).toBe("en");
  });
});
