const dragEvents = ["dragenter", "dragover"];

function fileSize(file) {
  return `${Math.max(1, Math.round(file.size / 1024))} KB`;
}

export function FileDropZone({ description, file, id, label, onChange }) {
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
    <label
      className={`file-dropzone${file ? " is-selected" : ""}`}
      htmlFor={id}
      onDragEnter={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      <input
        accept=".docx,.pdf,.md"
        id={id}
        type="file"
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
      />
      <span>{label}</span>
      <strong>{file ? file.name : "点击或拖拽文件到这里"}</strong>
      <small>{file ? fileSize(file) : description}</small>
      <span className="file-action">
        选择文件
      </span>
    </label>
  );
}
