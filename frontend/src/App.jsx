import { useMemo, useState } from "react";

import { downloadDocx, downloadMarkdown } from "./lib/download";
import { buildModelOptions } from "./lib/modelProfiles";
import { useSystemInfo } from "./hooks/useSystemInfo";
import { generateReport } from "./services/api";
import { AppShell } from "./modules/app-shell/AppShell";
import { OverviewModule } from "./modules/overview/OverviewModule";
import { ReportWorkspace } from "./modules/report-workspace/ReportWorkspace";
import { ResultModule } from "./modules/results/ResultModule";
import { SystemModule } from "./modules/system/SystemModule";

export default function App() {
  const reportState = useReportWorkflow();
  const { health, capabilities } = useSystemInfo();
  const [selectedCodingModel, setSelectedCodingModel] = useState("gpt");
  const [selectedCodingReasoningEffort, setSelectedCodingReasoningEffort] = useState("max");
  const [selectedCodingThinkingType, setSelectedCodingThinkingType] = useState("enabled");

  const modelOptions = useMemo(
    () => buildModelOptions(capabilities.coding_model_profiles),
    [capabilities.coding_model_profiles],
  );

  const onSubmit = (files) => reportState.generate(
    files,
    selectedCodingModel,
    selectedCodingReasoningEffort,
    selectedCodingThinkingType,
  );

  return (
    <AppShell agentTimeoutSeconds={health.timeoutSeconds}>
      <OverviewModule
        capabilities={capabilities}
        health={health}
        selectedCodingModel={selectedCodingModel}
      />
      <ReportWorkspace
        error={reportState.error}
        modelOptions={modelOptions}
        onModelChange={setSelectedCodingModel}
        onReasoningChange={setSelectedCodingReasoningEffort}
        onThinkingChange={setSelectedCodingThinkingType}
        onSubmit={onSubmit}
        reasoningOptions={capabilities.coding_reasoning_efforts?.deepseek ?? ["high", "max"]}
        selectedCodingReasoningEffort={selectedCodingReasoningEffort}
        selectedCodingModel={selectedCodingModel}
        selectedCodingThinkingType={selectedCodingThinkingType}
        submitting={reportState.submitting}
      />
      <ResultModule
        report={reportState.report}
        onDownloadMarkdown={reportState.downloadMarkdown}
        onDownloadDocx={reportState.downloadDocx}
      />
      <SystemModule capabilities={capabilities} health={health} />
    </AppShell>
  );
}

function useReportWorkflow() {
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const generate = async (
    files,
    selectedCodingModel,
    selectedCodingReasoningEffort,
    selectedCodingThinkingType,
  ) => {
    setSubmitting(true);
    setError(null);
    try {
      const payload = await generateReport({
        ...files,
        codingModelProfile: selectedCodingModel,
        codingReasoningEffort: selectedCodingReasoningEffort,
        codingThinkingType: selectedCodingThinkingType,
      });
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

  return {
    report,
    error,
    submitting,
    generate,
    downloadMarkdown: () => report && downloadMarkdown(report),
    downloadDocx: () => report && downloadDocx(report),
  };
}
