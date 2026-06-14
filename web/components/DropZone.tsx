import { type DragEvent, useRef, useState } from "react";

interface Props {
  onCsvText: (text: string) => void;
  error: string | null;
}

/**
 * Lets the user load a Usage Export into the browser.
 *
 * The selected file is read locally and passed upward as text; this component
 * does not upload or persist the CSV contents.
 */
export function DropZone({ onCsvText, error }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const readFile = (file: File | undefined) => {
    if (!file) return;
    file.text().then(onCsvText);
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
      <h2>CSVをここにドラッグ&ドロップ</h2>
      <p>
        Cursorダッシュボードからエクスポートした usage events CSV
        を読み込みます。データはブラウザ内で処理され、どこにも送信されません。
      </p>
      <p className="meta">クリックでファイル選択もできます</p>
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
