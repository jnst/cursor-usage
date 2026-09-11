import { useEffect, useId, useRef, useState } from "react";

import { type Language } from "../../src/core/language.ts";
import { useLanguage } from "../i18n/LanguageProvider.tsx";

/** A disclosure with native buttons; Tab moves between the language choices. */
export function LanguageSelector() {
  const { language, setLanguage } = useLanguage();
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !container.current?.contains(event.target))
        setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  const select = (next: Language) => {
    setLanguage(next);
    setOpen(false);
    trigger.current?.focus();
  };
  return (
    <div
      ref={container}
      className="language-selector"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          setOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      <button
        ref={trigger}
        type="button"
        className="reload-button language-toggle"
        aria-label="言語 / Language"
        title="言語 / Language"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
      >
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <ellipse cx="12" cy="12" rx="4" ry="9" />
          <path d="M3 12h18" />
        </svg>
      </button>
      <div
        id={id}
        className="language-options"
        role="group"
        aria-label="言語 / Language"
        hidden={!open}
      >
        {(["ja", "en"] as const).map((value) => (
          <button
            key={value}
            type="button"
            lang={value}
            aria-pressed={language === value}
            onClick={() => select(value)}
          >
            <span>{value === "ja" ? "日本語" : "English"}</span>
            <span aria-hidden="true">{language === value ? "✓" : ""}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
