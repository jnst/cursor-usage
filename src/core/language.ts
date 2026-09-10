export type Language = "ja" | "en";

export function isLanguage(value: unknown): value is Language {
  return value === "ja" || value === "en";
}

/** Use the first supported preference, including regional language tags. */
export function preferredLanguage(preferences: readonly string[]): Language {
  for (const preference of preferences) {
    const base = preference.toLowerCase().split(/[-_]/)[0];
    if (isLanguage(base)) return base;
  }
  return "en";
}
