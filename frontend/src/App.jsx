import { useMemo, useState } from "react";

import { downloadDocx, downloadMarkdown } from "./lib/download";
import { useSystemInfo } from "./hooks/useSystemInfo";
import { generateReport } from "./services/api";
import { CapabilitiesPanel } from "./ui/CapabilitiesPanel";
import { HealthCard } from "./ui/HealthCard";
import { ReportResult } from "./ui/ReportResult";
import { UploadPanel } from "./ui/UploadPanel";

export default function App() {
  const { health, capabilities } = useSystemInfo();
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const helperText = useMemo(
    () => "支持 `.docx`、`.pdf`、`.md`。DOCX 模板支持 `{{REPORT_TITLE}}` 与 `{{REPORT_BODY}}` 占位符。",
    [],
  );

  const onSubmit = async (files) => {
    setSubmitting(true);
    setError(null);
    try {
      const payload = await generateReport(files);
      setReport(payload);
    } catch (submitError) {
      setError({ message: submitError.message, code: submitError.code, source: submitError.source });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="page-shell">
      <section className="hero-card">
        <div className="hero-copy">
          <p className="eyebrow">全栈智能实验报告生成系统</p>
          <h1>上传作业与实验模板，自动生成完整实验报告</h1>
          <p className="hero-description">
            React 前端负责交互体验，Go 后端负责上传编排与统一 API，Python Agent 负责文档解析、任务求解与报告生成。
          </p>
        </div>
        <HealthCard health={health} />
      </section>

      <UploadPanel helperText={helperText} error={error} submitting={submitting} onSubmit={onSubmit} />

      <CapabilitiesPanel capabilities={capabilities} />

      <ReportResult
        report={report}
        onDownloadMarkdown={() => report && downloadMarkdown(report)}
        onDownloadDocx={() => report && downloadDocx(report)}
      />
    </main>
  );
}
