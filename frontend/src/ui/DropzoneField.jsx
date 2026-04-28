const dragEvents = ["dragenter", "dragover"];

export function DropzoneField({ description, file, id, label, onChange }) {
  const handleDrop = (event) => {
    event.preventDefault();
    const nextFile = event.dataTransfer.files?.[0] ?? null;
    onChange(nextFile);
  };

  const handleDrag = (event) => {
    if (dragEvents.includes(event.type)) {
      event.preventDefault();
    }
  };

  return (
    <label className={`dropzone-card${file ? " is-selected" : ""}`} htmlFor={id} onDragEnter={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}>
      <span>{label}</span>
      <input
        accept=".docx,.pdf,.md"
        id={id}
        type="file"
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
      />
      <strong>{file ? file.name : "点击或拖拽文件到这里"}</strong>
      <small>{file ? `${Math.max(1, Math.round(file.size / 1024))} KB` : description}</small>
    </label>
  );
}

