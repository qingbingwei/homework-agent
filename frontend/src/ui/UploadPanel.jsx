import { useState } from "react";

import { DropzoneField } from "./DropzoneField";

function getErrorTitle(error) {
  if (!error) {
    return "";
  }
  if (error.code === "upstream_quota_exceeded") {
    return "上游模型额度不足";
  }
  if (error.source === "agent") {
    return "Agent 处理失败";
  }
  return "请求失败";
}

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
          <p className="helper-text">支持点击选择，也支持拖拽文件直接投递。</p>
        </div>
      </div>

      <form className="upload-grid" onSubmit={handleSubmit}>
        <DropzoneField
          description="请选择 `.docx`、`.pdf` 或 `.md` 文件"
          file={assignment}
          id="assignment-file"
          label="作业文件"
          onChange={setAssignment}
        />

        <DropzoneField
          description="建议模板预留标题与正文占位符"
          file={template}
          id="template-file"
          label="实验模板"
          onChange={setTemplate}
        />

        <button className="primary-button" disabled={submitting || !assignment || !template} type="submit">
          {submitting ? "生成中..." : "生成实验报告"}
        </button>
      </form>

      <p className="helper-text">{helperText}</p>
      {error ? (
        <div className="error-banner" role="alert">
          <strong>{getErrorTitle(error)}</strong>
          <span>{error.message}</span>
        </div>
      ) : null}
    </section>
  );
}
