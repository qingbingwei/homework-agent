import { Card, Chip, ProgressBar, Surface } from "@heroui/react";

const pipelineSteps = ["文件识别", "计划生成", "Agent 执行", "报告合成"];

function StatusPill({ health }) {
  const ok = health.status === "ok";
  return (
    <Chip color={ok ? "success" : "danger"} variant="soft">
      {health.message}
    </Chip>
  );
}

function MetricCard({ label, value }) {
  return (
    <Surface className="metric-card" variant="secondary">
      <span>{label}</span>
      <strong>{value}</strong>
    </Surface>
  );
}

function PipelineSteps() {
  return (
    <ol className="pipeline-steps">
      {pipelineSteps.map((step, index) => (
        <li key={step}>
          <Chip size="sm" variant="soft">{index + 1}</Chip>
          <strong>{step}</strong>
        </li>
      ))}
    </ol>
  );
}

export function OverviewModule({ capabilities, health, selectedCodingModel }) {
  const formatCount = capabilities.supported_formats.length || 3;
  const modelCount = capabilities.coding_model_profiles.length || 2;

  return (
    <section className="overview-grid" id="overview">
      <Card className="hero-panel">
        <Card.Header>
          <div className="hero-copy-block">
            <p className="eyebrow">Document pipeline</p>
            <Card.Title>上传作业、套用模板、生成报告</Card.Title>
            <Card.Description>
              统一处理作业解析、任务计划、代码执行与模板合成。
            </Card.Description>
          </div>
          <StatusPill health={health} />
        </Card.Header>
        <Card.Content className="hero-metrics">
          <MetricCard label="当前 Coding Agent" value={selectedCodingModel} />
          <MetricCard label="支持格式" value={formatCount} />
          <MetricCard label="模型配置" value={modelCount} />
        </Card.Content>
      </Card>

      <Card className="timeline-panel">
        <Card.Header>
          <div>
            <Card.Title>生成链路</Card.Title>
            <Card.Description>{health.meta}</Card.Description>
          </div>
        </Card.Header>
        <Card.Content className="pipeline-list">
          <ProgressBar aria-label="生成链路进度" value={75} color="success" />
          <PipelineSteps />
        </Card.Content>
      </Card>
    </section>
  );
}
