import { type DragEvent, useRef, useState } from "react";

import { useLanguage } from "../i18n/LanguageProvider.tsx";

interface Props {
  onCsvText: (text: string, asDummy: boolean) => void;
  error: string | null;
  onReadError: () => void;
}

/** Reads a local file for either normal import or the shared dummy transformation. */
export function DropZone({ onCsvText, error, onReadError }: Props) {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedMode = useRef(false);
  const reading = useRef(false);
  const [isReading, setIsReading] = useState(false);
  const [dragOver, setDragOver] = useState<boolean | null>(null);

  const readFile = async (file: File | undefined, asDummy: boolean) => {
    if (!file || reading.current) return;
    reading.current = true;
    setIsReading(true);
    try {
      onCsvText(await file.text(), asDummy);
    } catch {
      onReadError();
    } finally {
      reading.current = false;
      setIsReading(false);
    }
  };

  const onDrop = (e: DragEvent, asDummy: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(null);
    void readFile(e.dataTransfer.files[0], asDummy);
  };

  return (
    <div className="csv-import" aria-busy={isReading}>
      <div className="csv-import-targets">
        {[false, true].map((asDummy) => {
          const id = asDummy ? "dummy-csv" : "original-csv";
          return (
            <div
              key={id}
              className={`dropzone${asDummy ? " dropzone-dummy" : ""}${dragOver === asDummy ? " dragover" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "copy";
                if (!reading.current) setDragOver(asDummy);
              }}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => onDrop(e, asDummy)}
            >
              <div className="icon" aria-hidden="true">
                {asDummy ? "🎭" : "📊"}
              </div>
              <h2 id={`${id}-title`}>{t(asDummy ? "Load as dummy CSV" : "Drop a CSV here")}</h2>
              <p id={`${id}-description`}>
                {t(
                  asDummy
                    ? "Replace emails, IDs, Spend, and Tokens with dummy values before displaying."
                    : "Load a Usage Export from the Cursor dashboard. Data is processed in your browser and is never sent anywhere.",
                )}
              </p>
              <p className="meta">{t("You can also click to choose a file")}</p>
              <button
                type="button"
                className="dropzone-select"
                aria-labelledby={`${id}-title`}
                aria-describedby={`${id}-description`}
                disabled={isReading}
                onClick={() => {
                  selectedMode.current = asDummy;
                  inputRef.current?.click();
                }}
              />
            </div>
          );
        })}
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
          void readFile(file, selectedMode.current);
        }}
      />
    </div>
  );
}
