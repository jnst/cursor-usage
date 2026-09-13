import { type DragEvent, useRef, useState } from "react";

import { useLanguage } from "../i18n/LanguageProvider.tsx";

interface Props {
  onCsvText: (text: string) => void;
  error: string | null;
  onReadError: () => void;
}

/** Read the selected file locally; transformation is deferred until requested in the dashboard. */
export function DropZone({ onCsvText, error, onReadError }: Props) {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const reading = useRef(false);
  const [isReading, setIsReading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const readFile = async (file: File | undefined) => {
    if (!file || reading.current) return;
    reading.current = true;
    setIsReading(true);
    try {
      onCsvText(await file.text());
    } catch {
      onReadError();
    } finally {
      reading.current = false;
      setIsReading(false);
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    void readFile(e.dataTransfer.files[0]);
  };

  return (
    <div className="csv-import" aria-busy={isReading}>
      <div
        className={`dropzone${dragOver ? " dragover" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
          if (!reading.current) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <div className="icon" aria-hidden="true">
          📊
        </div>
        <h2 id="csv-title">{t("Drop a CSV here")}</h2>
        <p id="csv-description">
          {t(
            "Load a Usage Export from the Cursor dashboard. Data is processed in your browser and is never sent anywhere.",
          )}
        </p>
        <p className="meta">{t("You can also click to choose a file")}</p>
        <button
          type="button"
          className="dropzone-select"
          aria-labelledby="csv-title"
          aria-describedby="csv-description"
          disabled={isReading}
          onClick={() => inputRef.current?.click()}
        />
      </div>
      {isReading && (
        <p className="import-status" role="status">
          {t("Reading CSV…")}
        </p>
      )}
      {error && (
        <p className="import-error" role="alert">
          {error}
        </p>
      )}
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        hidden
        onChange={(e) => {
          const file = e.currentTarget.files?.[0];
          e.currentTarget.value = "";
          void readFile(file);
        }}
      />
    </div>
  );
}
