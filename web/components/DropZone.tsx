import { type DragEvent, useRef, useState } from "react";

import { useLanguage } from "../i18n/LanguageProvider.tsx";

interface Props {
  onCsvText: (text: string) => void;
  error: string | null;
  onReadError: () => void;
}

/**
 * Lets the user load a Usage Export into the browser.
 *
 * The selected file is read locally and passed upward as text; this component
 * does not upload or persist the CSV contents.
 */
export function DropZone({ onCsvText, error, onReadError }: Props) {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const readFile = (file: File | undefined) => {
    if (!file) return;
    file.text().then(onCsvText).catch(onReadError);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    readFile(e.dataTransfer.files[0]);
  };

  return (
    <div
      className={`dropzone${dragOver ? " dragover" : ""}`}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      <div className="icon">📊</div>
      <h2>{t("Drop a CSV here")}</h2>
      <p>
        {t(
          "Load a Usage Export from the Cursor dashboard. Data is processed in your browser and is never sent anywhere.",
        )}
      </p>
      <p className="meta">{t("You can also click to choose a file")}</p>
      {error && <p className="error">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        style={{ display: "none" }}
        onChange={(e) => readFile(e.target.files?.[0])}
      />
    </div>
  );
}
