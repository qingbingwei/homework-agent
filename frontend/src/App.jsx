import { useMemo, useState } from "react";

import { downloadDocx, downloadMarkdown } from "./lib/download";
import { useSystemInfo } from "./hooks/useSystemInfo";
import { generateReport } from "./services/api";
import { CapabilitiesPanel } from "./ui/CapabilitiesPanel";
import { HealthCard } from "./ui/HealthCard";
import { ReportResult } from "./ui/ReportResult";
import { UploadPanel } from "./ui/UploadPanel";

const MODEL_LABELS = {
  gpt: { label: "GPT", description: "gpt-5.5 coding agent" },
  deepseek: { label: "DeepSeek", description: "deepseek-v4-pro coding agent" },
};

const HELPER_TEXT = "支持 `.docx`、`.pdf`、`.md`。DOCX 模板支持 `{{REPORT_TITLE}}` 与 `{{REPORT_BODY}}` 占位符。";

function buildModelOptions(profiles) {
  const values = profiles.length > 0 ? profiles : ["gpt", "deepseek"];
  return values.map((profile) => ({
    value: profile,
    label: MODEL_LABELS[profile]?.label || profile,
    description: MODEL_LABELS[profile]?.description || profile,
  }));
}

function WorkspaceHeader({ health }) {
  return (
    <section className="workspace-header">
      <div className="hero-copy">
        <p className="eyebrow">Homework Agent</p>
        <h1>实验报告工作台</h1>
        <p className="hero-description">上传作业与模板，选择 coding agent 模型，生成 Markdown 预览和 DOCX 报告。</p>
      </div>
      <HealthCard health={health} />
    </section>
  );
}

export default function App() {
  const { health, capabilities } = useSystemInfo();
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [selectedCodingModel, setSelectedCodingModel] = useState("gpt");

  const modelOptions = useMemo(
    () => buildModelOptions(capabilities.coding_model_profiles),
    [capabilities.coding_model_profiles],
  );

  const onSubmit = async (files) => {
    setSubmitting(true);
    setError(null);
    try {
      const payload = await generateReport({ ...files, codingModelProfile: selectedCodingModel });
      setReport(payload);
    } catch (submitError) {
      setError({
        message: submitError.message,
        code: submitError.code,
        source: submitError.source,
        requestId: submitError.requestId,
        stage: submitError.stage,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="page-shell">
      <WorkspaceHeader health={health} />

      <UploadPanel
        error={error}
        helperText={HELPER_TEXT}
        modelOptions={modelOptions}
        onModelChange={setSelectedCodingModel}
        onSubmit={onSubmit}
        selectedCodingModel={selectedCodingModel}
        submitting={submitting}
      />

      <CapabilitiesPanel capabilities={capabilities} />

      <ReportResult
        report={report}
        onDownloadMarkdown={() => report && downloadMarkdown(report)}
        onDownloadDocx={() => report && downloadDocx(report)}
      />
    </main>
  );
}
