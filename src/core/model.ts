export const AUTO_MODEL_FAMILY = "Auto";

/**
 * Display labels for known Model Family slugs.
 *
 * Keys are Model identifiers with variant suffixes (reasoning effort,
 * thinking, fast) already stripped. Unknown slugs intentionally fall back to
 * the stripped slug itself so new models still group correctly across their
 * variants without a release.
 */
const FAMILY_LABELS: Record<string, string> = {
  "cursor-grok-4.5": "Grok 4.5",
  "claude-opus-4-8": "Opus 4.8",
  "claude-opus-5": "Opus 5",
  "claude-4.5-opus": "Opus 4.5",
  "claude-4.6-opus": "Opus 4.6",
  "claude-fable-5": "Fable 5",
  "claude-sonnet-5": "Sonnet 5",
  "claude-4.5-sonnet": "Sonnet 4.5",
  "claude-4.5-haiku": "Haiku 4.5",
  "gpt-5.6-sol": "GPT-5.6 Sol",
  "gpt-5.6-luna": "GPT-5.6 Luna",
  "gpt-5.6-terra": "GPT-5.6 Terra",
  "gpt-5.3-codex": "GPT-5.3 Codex",
  "gpt-5.5": "GPT-5.5",
  "composer-2.5": "Composer 2.5",
  "kimi-k3": "Kimi K3",
  github_bugbot: "Bugbot",
};

/**
 * Variant suffix tokens that distinguish Models within one Model Family:
 * reasoning effort levels, the thinking flag, and fast mode. Suffix order
 * varies between exports (`-thinking-high` vs `-high-thinking`), so tokens
 * are stripped from the end regardless of order.
 */
const VARIANT_TOKENS = new Set(["thinking", "high", "medium", "low", "max", "fast"]);

/** Usage Exports contain zero-width characters in some display names. */
const INVISIBLE_CHARS = /[\u200b\u200c\u200d\ufeff]/g;

/**
 * Display names such as `Opus 5 (Auto Balanced)` mark usage routed through
 * Cursor's Auto (Cursor Router); the parenthesized part names the Router mode.
 */
const AUTO_DISPLAY_NAME = /\(Auto[^)]*\)$/;

/**
 * Returns the Model Family for a Model identifier.
 *
 * Model Families group Models that differ only by variant attributes such as
 * reasoning effort, thinking, and fast mode. Usage routed through Cursor's
 * Auto (Cursor Router) is grouped into the `Auto` Model Family regardless of
 * the routed Model or Router mode; the routed Model stays visible in
 * Model-level detail views.
 */
export function modelFamilyOf(model: string): string {
  const sanitized = model.replace(INVISIBLE_CHARS, "").trim();
  if (AUTO_DISPLAY_NAME.test(sanitized)) return AUTO_MODEL_FAMILY;

  const lower = sanitized.toLowerCase();
  if (lower === "auto" || lower === "auto-smart") return AUTO_MODEL_FAMILY;

  const known = FAMILY_LABELS[lower];
  if (known) return known;

  const tokens = lower.split("-");
  while (tokens.length > 1 && VARIANT_TOKENS.has(tokens[tokens.length - 1]!)) {
    tokens.pop();
  }
  const slug = tokens.join("-");
  return FAMILY_LABELS[slug] ?? (slug === lower ? sanitized : slug);
}
