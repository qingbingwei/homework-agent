import { useState } from "react";

const acceptedTypes = ".docx,.pdf,.md";

export function UploadPanel({ helperText, error, submitting, onSubmit }) {
  const [assignment, setAssignment] = useState(null);
  const [template, setTemplate] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!assignment || !template) {
      return;
    }
    await onSubmit({ assignment, template });
  };

  return (
    <section className="panel-card">
      <div className="panel-header">
        <div>
          <p className="eyebrow">文件输入</p>
          <h2>上传作业与模板</h2>
        </div>
      </div>

      <form className="upload-grid" onSubmit={handleSubmit}>
        <label className="field-card">
          <span>作业文件</span>
          <input accept={acceptedTypes} type="file" onChange={(event) => setAssignment(event.target.files?.[0] ?? null)} />
          <small>{assignment ? assignment.name : "请选择 `.docx`、`.pdf` 或 `.md` 文件"}</small>
        </label>

        <label className="field-card">
          <span>实验模板</span>
          <input accept={acceptedTypes} type="file" onChange={(event) => setTemplate(event.target.files?.[0] ?? null)} />
          <small>{template ? template.name : "建议模板预留标题与正文占位符"}</small>
        </label>

        <button className="primary-button" disabled={submitting || !assignment || !template} type="submit">
          {submitting ? "生成中..." : "生成实验报告"}
        </button>
      </form>

      <p className="helper-text">{helperText}</p>
      {error ? <p className="error-banner">{error}</p> : null}
    </section>
  );
}

