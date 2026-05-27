import { Chip } from "@heroui/react";
import { useRef, useState } from "react";

const dragEvents = ["dragenter", "dragover"];

function fileSize(file) {
  return `${Math.max(1, Math.round(file.size / 1024))} KB`;
}

function UploadIcon({ filled }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {filled ? (
        <>
          <path d="M9 12.75 11.25 15 15 9.75" />
          <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </>
      ) : (
        <>
          <path d="M12 16.5V4.5" />
          <path d="m7.5 9 4.5-4.5L16.5 9" />
          <path d="M3.75 16.5v2.25A2.25 2.25 0 0 0 6 21h12a2.25 2.25 0 0 0 2.25-2.25V16.5" />
        </>
      )}
    </svg>
  );
}

export function FileDropZone({ description, file, id, label, onChange }) {
  const inputRef = useRef(null);
  const [hovering, setHovering] = useState(false);

  const handleDrop = (event) => {
    event.preventDefault();
    setHovering(false);
    onChange(event.dataTransfer.files?.[0] ?? null);
  };

  const handleDrag = (event) => {
    if (dragEvents.includes(event.type)) {
      event.preventDefault();
      setHovering(true);
    }
    if (event.type === "dragleave") setHovering(false);
  };

  const handleClick = () => inputRef.current?.click();

  return (
    <div
      className={`ha-dropzone${file ? " is-selected" : ""}${hovering ? " is-selected" : ""}`}
      onClick={handleClick}
      onDragEnter={handleDrag}
      onDragOver={handleDrag}
      onDragLeave={handleDrag}
      onDrop={handleDrop}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && handleClick()}
    >
      <input
        accept=".docx,.pdf,.md"
        id={id}
        ref={inputRef}
        type="file"
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
      />

      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-bold text-[var(--brand-ink)]">{label}</span>
        <Chip size="sm" variant="soft">docx · pdf · md</Chip>
      </div>

      <div className="grid place-items-center content-center gap-3">
        <span
          className={`grid h-12 w-12 place-items-center rounded-2xl transition-all duration-200 ${
            file
              ? "bg-[var(--brand-primary)] text-white shadow-[0_8px_20px_-8px_rgba(13,148,136,0.55)]"
              : "bg-[rgba(13,148,136,0.10)] text-[var(--brand-primary)]"
          }`}
        >
          <UploadIcon filled={Boolean(file)} />
        </span>
        <strong className="text-center text-[14px] font-bold leading-tight text-[var(--brand-ink)]">
          {file ? file.name : "点击或拖拽文件"}
        </strong>
        <small className="text-center text-[12px] leading-relaxed text-[var(--muted)]">
          {file ? `${fileSize(file)} · 已就绪` : description}
        </small>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--muted)]">
          {file ? "Replace" : "Choose file"}
        </span>
        <button
          type="button"
          className="ha-ghost-btn inline-flex h-8 items-center justify-center px-3 text-[12px] font-semibold cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            handleClick();
          }}
        >
          {file ? "重新选择" : "浏览文件"}
        </button>
      </div>
    </div>
  );
}
