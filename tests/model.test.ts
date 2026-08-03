import { describe, expect, test } from "bun:test";

import { modelFamilyOf } from "../src/core/model.ts";

describe("modelFamilyOf", () => {
  test("groups Auto (Cursor Router) usage at the Router level", () => {
    expect(modelFamilyOf("Opus 5 (Auto Balanced)")).toBe("Auto");
    expect(modelFamilyOf("Opus 4.8 (Auto Intelligence)")).toBe("Auto");
    expect(modelFamilyOf("Cursor Grok 4.5 (Auto)")).toBe("Auto");
    expect(modelFamilyOf("auto")).toBe("Auto");
    expect(modelFamilyOf("auto-smart")).toBe("Auto");
  });

  test("strips zero-width characters from display names", () => {
    expect(modelFamilyOf("Cursor Grok 4.5 Fast\u200b (Auto Balanced)")).toBe("Auto");
  });

  test("collapses reasoning effort, thinking, and fast variants", () => {
    expect(modelFamilyOf("cursor-grok-4.5-high-fast")).toBe("Grok 4.5");
    expect(modelFamilyOf("cursor-grok-4.5-low")).toBe("Grok 4.5");
    expect(modelFamilyOf("claude-fable-5-thinking-high")).toBe("Fable 5");
    expect(modelFamilyOf("claude-fable-5-high")).toBe("Fable 5");
    expect(modelFamilyOf("gpt-5.6-luna-max-fast")).toBe("GPT-5.6 Luna");
    expect(modelFamilyOf("kimi-k3-max")).toBe("Kimi K3");
    expect(modelFamilyOf("gpt-5.5-high")).toBe("GPT-5.5");
  });

  test("handles variant suffixes in either order", () => {
    expect(modelFamilyOf("claude-opus-4-8-thinking-high")).toBe("Opus 4.8");
    expect(modelFamilyOf("claude-4.6-opus-high-thinking")).toBe("Opus 4.6");
  });

  test("maps known slugs without variant suffixes", () => {
    expect(modelFamilyOf("composer-2.5")).toBe("Composer 2.5");
    expect(modelFamilyOf("composer-2.5-fast")).toBe("Composer 2.5");
    expect(modelFamilyOf("claude-4.5-sonnet")).toBe("Sonnet 4.5");
    expect(modelFamilyOf("gpt-5.3-codex")).toBe("GPT-5.3 Codex");
    expect(modelFamilyOf("github_bugbot")).toBe("Bugbot");
  });

  test("falls back to the stripped slug for unknown models", () => {
    expect(modelFamilyOf("gpt-7-nova-high")).toBe("gpt-7-nova");
    expect(modelFamilyOf("gpt-7-nova-thinking-medium-fast")).toBe("gpt-7-nova");
  });

  test("keeps unknown models without variant suffixes as-is", () => {
    expect(modelFamilyOf("SomeFutureModel")).toBe("SomeFutureModel");
  });
});
