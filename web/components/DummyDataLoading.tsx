import { useLayoutEffect, useRef, useId } from "react";

import { useLanguage } from "../i18n/LanguageProvider.tsx";

/** Native modality blocks pointer and keyboard access until preparation ends. */
export function DummyDataLoading() {
  const { t } = useLanguage();
  const dialog = useRef<HTMLDialogElement>(null);
  const labelId = useId();

  useLayoutEffect(() => {
    const element = dialog.current!;
    const previousFocus = document.activeElement;
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    element.showModal();
    return () => {
      element.close();
      document.documentElement.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);

  return (
    <dialog
      ref={dialog}
      className="dummy-data-loading"
      aria-labelledby={labelId}
      onCancel={(event) => event.preventDefault()}
    >
      <progress className="loading-spinner" aria-labelledby={labelId} />
      <p id={labelId} role="status">
        {t("Preparing dummy data…")}
      </p>
    </dialog>
  );
}
