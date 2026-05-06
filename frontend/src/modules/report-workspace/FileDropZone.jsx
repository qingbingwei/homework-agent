import { Button, Chip } from "@heroui/react";
import { useRef } from "react";

const dragEvents = ["dragenter", "dragover"];

function fileSize(file) {
  return `${Math.max(1, Math.round(file.size / 1024))} KB`;
}

export function FileDropZone({ description, file, id, label, onChange }) {
  const inputRef = useRef(null);

  const handleDrop = (event) => {
    event.preventDefault();
    onChange(event.dataTransfer.files?.[0] ?? null);
  };

  const handleDrag = (event) => {
    if (dragEvents.includes(event.type)) {
      event.preventDefault();
    }
  };

  return (
    <div
      className={`file-dropzone${file ? " is-selected" : ""}`}
      onDragEnter={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      <input
        accept=".docx,.pdf,.md"
        id={id}
        ref={inputRef}
        type="file"
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
      />
      <div className="dropzone-top">
        <span>{label}</span>
        <Chip size="sm" variant="soft">docx · pdf · md</Chip>
      </div>
      <strong>{file ? file.name : "点击或拖拽文件"}</strong>
      <small>{file ? fileSize(file) : description}</small>
      <Button
        className="file-action"
        size="sm"
        type="button"
        variant="secondary"
        onPress={() => inputRef.current?.click()}
      >
        选择文件
      </Button>
    </div>
  );
}
