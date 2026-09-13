import { useLanguage } from "../i18n/LanguageProvider.tsx";
import { TooltipButton } from "./TooltipButton.tsx";

interface Props {
  active: boolean;
  preparing: boolean;
  onToggle: () => void;
}

export function DummyDataToggle({ active, preparing, onToggle }: Props) {
  const { t } = useLanguage();
  return (
    <TooltipButton
      type="button"
      className="reload-button dummy-data-toggle"
      aria-label={t("Show dummy data")}
      tooltipSuppressed={preparing}
      aria-pressed={active}
      aria-busy={preparing}
      aria-disabled={preparing}
      onClick={preparing ? undefined : onToggle}
    >
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M3 5c3 1.5 6 1.5 9 0 3 1.5 6 1.5 9 0v7c0 5-6 9-9 9s-9-4-9-9Z" />
        <path d="M6 10h3m6 0h3m-9 6c2 1 4 1 6 0" />
      </svg>
    </TooltipButton>
  );
}
