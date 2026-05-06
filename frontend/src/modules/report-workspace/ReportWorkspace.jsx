import { Alert, Button, Card, Chip, Spinner } from "@heroui/react";
import { useState } from "react";

import { FileDropZone } from "./FileDropZone";
import { ModelSelector } from "./ModelSelector";

const helperText = "支持 `.docx`、`.pdf`、`.md`。DOCX 模板支持 `{{REPORT_TITLE}}` 与 `{{REPORT_BODY}}` 占位符。";

function getErrorTitle(error) {
  if (!error) return "";
  if (error.code === "upstream_quota_exceeded") return "上游模型额度不足";
  if (error.source === "agent") return "Agent 处理失败";
  return "请求失败";
}

function getErrorMeta(error) {
  if (!error) return "";
  const parts = [];
  if (error.stage) parts.push(`阶段: ${error.stage}`);
  if (error.requestId) parts.push(`请求 ID: ${error.requestId}`);
  return parts.join(" · ");
}

function ErrorNotice({ error }) {
  if (!error) return null;
  return (
    <Alert status="danger">
      <Alert.Content>
        <Alert.Title>{getErrorTitle(error)}</Alert.Title>
        <Alert.Description>{error.message}</Alert.Description>
        {getErrorMeta(error) ? <small>{getErrorMeta(error)}</small> : null}
      </Alert.Content>
    </Alert>
  );
}

function FileInputs({ assignment, onAssignmentChange, onTemplateChange, template }) {
  return (
    <div className="file-grid">
      <FileDropZone
        description="请选择 `.docx`、`.pdf` 或 `.md` 文件"
        file={assignment}
        id="assignment-file"
        label="作业文件"
        onChange={onAssignmentChange}
      />
      <FileDropZone
        description="建议模板预留标题与正文占位符"
        file={template}
        id="template-file"
        label="实验模板"
        onChange={onTemplateChange}
      />
    </div>
  );
}

function ReportFormCard({ error, onSubmit, submitting }) {
  const [assignment, setAssignment] = useState(null);
  const [template, setTemplate] = useState(null);
  const canSubmit = Boolean(assignment && template && !submitting);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!assignment || !template) return;
    await onSubmit({ assignment, template });
  };

  return (
    <Card className="module-card report-form-card">
      <Card.Header>
        <div>
          <p className="eyebrow">Input files</p>
          <Card.Title>上传作业与实验模板</Card.Title>
          <Card.Description>{helperText}</Card.Description>
        </div>
        <Chip size="sm" variant="soft">2 files required</Chip>
      </Card.Header>
      <Card.Content>
        <form className="report-form" onSubmit={handleSubmit}>
          <FileInputs
            assignment={assignment}
            onAssignmentChange={setAssignment}
            onTemplateChange={setTemplate}
            template={template}
          />
          <ErrorNotice error={error} />
          <div className="submit-row">
            <span>输出 Markdown 预览与 DOCX 文件</span>
            <Button isDisabled={!canSubmit} type="submit" variant="primary">
              {submitting ? <Spinner size="sm" /> : null}
              {submitting ? "生成中..." : "生成实验报告"}
            </Button>
          </div>
        </form>
      </Card.Content>
    </Card>
  );
}

export function ReportWorkspace({
  error,
  modelOptions,
  onModelChange,
  onSubmit,
  selectedCodingModel,
  submitting,
}) {
  return (
    <section className="workspace-grid" id="workspace">
      <ModelSelector
        modelOptions={modelOptions}
        onModelChange={onModelChange}
        selectedCodingModel={selectedCodingModel}
      />

      <ReportFormCard error={error} onSubmit={onSubmit} submitting={submitting} />
    </section>
  );
}
