import { Alert, Button, Chip, Spinner } from "@heroui/react";
import { useState } from "react";

import { FileDropZone } from "./FileDropZone";
import { ModelSelector } from "./ModelSelector";

const helperText = "支持 .docx、.pdf、.md 格式。Word 模板可选；未上传模板时直接生成 DOCX。";

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
        {getErrorMeta(error) ? (
          <small className="mt-1 block text-[11px] text-[var(--muted)]">{getErrorMeta(error)}</small>
        ) : null}
      </Alert.Content>
    </Alert>
  );
}

function FileInputs({ assignment, onAssignmentChange, onTemplateChange, template }) {
  return (
    <div className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
      <FileDropZone
        description="请选择 .docx、.pdf 或 .md 文件"
        file={assignment}
        id="assignment-file"
        label="作业文件"
        onChange={onAssignmentChange}
      />
      <FileDropZone
        description="可选。上传 .docx 模板可保留原有 Word 结构。"
        file={template}
        id="template-file"
        label="实验模板（可选）"
        onChange={onTemplateChange}
      />
    </div>
  );
}

function ReportFormCard({ error, onSubmit, submitting }) {
  const [assignment, setAssignment] = useState(null);
  const [template, setTemplate] = useState(null);
  const [supplementalInstructions, setSupplementalInstructions] = useState("");
  const canSubmit = Boolean(assignment && !submitting);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!assignment) return;
    await onSubmit({ assignment, template, supplementalInstructions });
  };

  return (
    <div className="ha-glass-card grid h-full gap-5 p-7">
      <div className="flex items-start justify-between gap-4 max-[640px]:flex-col">
        <div className="grid gap-1">
          <p className="ha-eyebrow">Input files</p>
          <h3 className="m-0 text-[17px] font-bold leading-tight text-[var(--brand-ink)]">
            上传作业与可选模板
          </h3>
          <p className="m-0 max-w-lg text-[12px] leading-relaxed text-[var(--muted)]">
            {helperText}
          </p>
        </div>
        <Chip size="sm" variant="soft" color="warning">1 file required</Chip>
      </div>

      <form className="grid h-full gap-5" onSubmit={handleSubmit}>
        <FileInputs
          assignment={assignment}
          onAssignmentChange={setAssignment}
          onTemplateChange={setTemplate}
          template={template}
        />

        <div className="grid gap-2">
          <label
            className="text-[13px] font-bold text-[var(--brand-ink)]"
            htmlFor="agent-notes"
          >
            Agent 补充说明
          </label>
          <textarea
            className="ha-textarea"
            id="agent-notes"
            onChange={(event) => setSupplementalInstructions(event.target.value)}
            placeholder="例如：不要规划得过于复杂，优先生成简洁报告。"
            rows={4}
            value={supplementalInstructions}
          />
        </div>

        <ErrorNotice error={error} />

        <div className="mt-auto flex items-center justify-between gap-4 border-t border-[rgba(15,23,42,0.06)] pt-5 max-[640px]:flex-col max-[640px]:items-stretch">
          <span className="text-[12px] text-[var(--muted)]">
            输出 Markdown 预览与 DOCX 文件
          </span>
          <Button
            className={`ha-cta-btn inline-flex h-11 items-center justify-center gap-2 px-6 text-[14px] font-bold cursor-pointer ${!canSubmit ? "opacity-50 pointer-events-none" : ""}`}
            isDisabled={!canSubmit}
            type="submit"
          >
            {submitting ? <Spinner size="sm" color="white" /> : null}
            {submitting ? "生成中..." : "生成实验报告 →"}
          </Button>
        </div>
      </form>
    </div>
  );
}

export function ReportWorkspace({
  error,
  modelOptions,
  onModelChange,
  onReasoningChange,
  onThinkingChange,
  onSubmit,
  reasoningOptions,
  selectedCodingReasoningEffort,
  selectedCodingModel,
  selectedCodingThinkingType,
  submitting,
}) {
  return (
    <section
      className="grid grid-cols-12 gap-6 max-[1080px]:grid-cols-1"
      id="workspace"
    >
      <div className="col-span-4 max-[1080px]:col-span-1">
        <ModelSelector
          modelOptions={modelOptions}
          onModelChange={onModelChange}
          onReasoningChange={onReasoningChange}
          onThinkingChange={onThinkingChange}
          reasoningOptions={reasoningOptions}
          selectedCodingReasoningEffort={selectedCodingReasoningEffort}
          selectedCodingModel={selectedCodingModel}
          selectedCodingThinkingType={selectedCodingThinkingType}
        />
      </div>

      <div className="col-span-8 max-[1080px]:col-span-1">
        <ReportFormCard error={error} onSubmit={onSubmit} submitting={submitting} />
      </div>
    </section>
  );
}
