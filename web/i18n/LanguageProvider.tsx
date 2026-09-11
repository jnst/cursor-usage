import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import { isLanguage, preferredLanguage, type Language } from "../../src/core/language.ts";
import { translator } from "./messages.ts";

export const LANGUAGE_STORAGE_KEY = "cursor-usage.language";

export function initialLanguage(): Language {
  if (isLanguage(window.__CURSOR_USAGE_LANGUAGE__)) return window.__CURSOR_USAGE_LANGUAGE__;
  try {
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (isLanguage(saved)) return saved;
  } catch {
    // Language selection still works when browser storage is unavailable.
  }
  return preferredLanguage(
    navigator.languages?.length ? navigator.languages : [navigator.language],
  );
}

const Context = createContext<{ language: Language; setLanguage: (next: Language) => void }>({
  language: "en",
  setLanguage: () => {},
});

export function LanguageProvider({
  children,
  initial,
}: {
  children: ReactNode;
  initial: Language;
}) {
  const [language, updateLanguage] = useState(initial);
  const value = useMemo(
    () => ({
      language,
      setLanguage: (next: Language) => {
        document.documentElement.lang = next;
        updateLanguage(next);
        try {
          localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
        } catch {
          // Persist only the preference, never Usage Export data.
        }
      },
    }),
    [language],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useLanguage() {
  const { language, setLanguage } = useContext(Context);
  const t = useMemo(() => translator(language), [language]);
  return { language, setLanguage, t };
}
