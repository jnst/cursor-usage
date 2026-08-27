import { describe, expect, it } from "bun:test";

import { hasFastMode, modelFamilyOf } from "./model.ts";

describe("modelFamilyOf", () => {
  it("groups Auto (Cursor Router) usage at the Router level", () => {
    expect(modelFamilyOf("Opus 5 (Auto Balanced)")).toBe("Auto");
    expect(modelFamilyOf("Opus 4.8 (Auto Intelligence)")).toBe("Auto");
    expect(modelFamilyOf("Cursor Grok 4.5 (Auto)")).toBe("Auto");
    expect(modelFamilyOf("auto")).toBe("Auto");
    expect(modelFamilyOf("auto-smart")).toBe("Auto");
  });

  it("keeps suffixed Auto slugs in the Auto family", () => {
    expect(modelFamilyOf("auto-high")).toBe("Auto");
    expect(modelFamilyOf("auto-smart-high")).toBe("Auto");
    expect(modelFamilyOf("auto-fast")).toBe("Auto");
  });

  it("strips zero-width characters from display names", () => {
    expect(modelFamilyOf("Cursor Grok 4.5 Fast\u200b (Auto Balanced)")).toBe("Auto");
  });

  it("collapses reasoning effort, thinking, and fast variants", () => {
    expect(modelFamilyOf("cursor-grok-4.5-high-fast")).toBe("Grok 4.5");
    expect(modelFamilyOf("cursor-grok-4.5-low")).toBe("Grok 4.5");
    expect(modelFamilyOf("claude-fable-5-thinking-high")).toBe("Fable 5");
    expect(modelFamilyOf("claude-fable-5-high")).toBe("Fable 5");
    expect(modelFamilyOf("gpt-5.6-luna-max-fast")).toBe("GPT-5.6 Luna");
    expect(modelFamilyOf("gpt-5.6-luna-xhigh")).toBe("GPT-5.6 Luna");
    expect(modelFamilyOf("gpt-5.6-sol-xhigh")).toBe("GPT-5.6 Sol");
    expect(modelFamilyOf("cursor-grok-4.6-xhigh")).toBe("Grok 4.6");
    expect(modelFamilyOf("cursor-grok-4.6")).toBe("Grok 4.6");
    expect(modelFamilyOf("kimi-k3-max")).toBe("Kimi K3");
    expect(modelFamilyOf("gpt-5.5-high")).toBe("GPT-5.5");
  });

  it("handles variant suffixes in either order", () => {
    expect(modelFamilyOf("claude-opus-4-8-thinking-high")).toBe("Opus 4.8");
    expect(modelFamilyOf("claude-4.6-opus-high-thinking")).toBe("Opus 4.6");
  });

  it("maps known slugs without variant suffixes", () => {
    expect(modelFamilyOf("composer-2.5")).toBe("Composer 2.5");
    expect(modelFamilyOf("composer-2.5-fast")).toBe("Composer 2.5");
    expect(modelFamilyOf("claude-4.5-sonnet")).toBe("Sonnet 4.5");
    expect(modelFamilyOf("gpt-5.3-codex")).toBe("GPT-5.3 Codex");
    expect(modelFamilyOf("github_bugbot")).toBe("Bugbot");
  });

  it("falls back to the stripped slug for unknown models", () => {
    expect(modelFamilyOf("gpt-7-nova-high")).toBe("gpt-7-nova");
    expect(modelFamilyOf("gpt-7-nova-thinking-medium-fast")).toBe("gpt-7-nova");
  });

  it("keeps unknown models without variant suffixes as-is", () => {
    expect(modelFamilyOf("SomeFutureModel")).toBe("SomeFutureModel");
  });

  it("groups mixed-case unknown models with their variants", () => {
    expect(modelFamilyOf("SomeFutureModel-high")).toBe("SomeFutureModel");
    expect(modelFamilyOf("SomeFutureModel-Thinking-High")).toBe("SomeFutureModel");
    expect(modelFamilyOf("SomeFutureModel-high")).toBe(modelFamilyOf("SomeFutureModel"));
  });

  it("trims whitespace and keeps an empty identifier as-is", () => {
    expect(modelFamilyOf("  composer-2.5  ")).toBe("Composer 2.5");
    expect(modelFamilyOf("")).toBe("");
    expect(modelFamilyOf("   ")).toBe("");
  });
});

describe("hasFastMode", () => {
  it("matches the trailing -fast suffix seen in Usage Exports", () => {
    expect(hasFastMode("cursor-grok-4.6-high-fast")).toBe(true);
    expect(hasFastMode("claude-opus-5-thinking-high-fast")).toBe(true);
    expect(hasFastMode("gpt-5.6-luna-medium-fast")).toBe(true);
    expect(hasFastMode("composer-2.5-fast")).toBe(true);
  });

  it("does not match Models without a fast suffix token", () => {
    expect(hasFastMode("cursor-grok-4.6-high")).toBe(false);
    expect(hasFastMode("claude-fable-5-thinking-high")).toBe(false);
    expect(hasFastMode("kimi-k3-max")).toBe(false);
    expect(hasFastMode("Cursor Grok 4.6 (Auto)")).toBe(false);
    expect(hasFastMode("Cursor Grok 4.5 Fast (Auto Balanced)")).toBe(false);
    expect(hasFastMode("")).toBe(false);
  });

  it("still matches if a later export reorders variant suffixes", () => {
    expect(hasFastMode("claude-opus-5-fast-thinking-high")).toBe(true);
    expect(hasFastMode("SomeFutureModel-Fast")).toBe(true);
  });
});
