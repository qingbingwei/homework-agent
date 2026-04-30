import { Card, Chip, ProgressBar } from "@heroui/react";

function StatusPill({ health }) {
  const ok = health.status === "ok";
  return (
    <Chip color={ok ? "success" : "danger"} variant="soft">
      {health.message}
    </Chip>
  );
}

export function OverviewModule({ capabilities, health, selectedCodingModel }) {
  const formatCount = capabilities.supported_formats.length || 3;
  const modelCount = capabilities.coding_model_profiles.length || 2;

  return (
    <section className="overview-grid" id="overview">
      <Card className="hero-panel">
        <Card.Header>
          <div>
            <p className="eyebrow">Document pipeline</p>
            <Card.Title>上传作业、套用模板、生成报告</Card.Title>
            <Card.Description>
              前端负责交互，Go 后端负责任务编排，Agent 负责解析、推理、代码执行与报告合成。
            </Card.Description>
          </div>
          <StatusPill health={health} />
        </Card.Header>
        <Card.Content className="hero-metrics">
          <div>
            <span>当前 Coding Agent</span>
            <strong>{selectedCodingModel}</strong>
          </div>
          <div>
            <span>支持格式</span>
            <strong>{formatCount}</strong>
          </div>
          <div>
            <span>模型配置</span>
            <strong>{modelCount}</strong>
          </div>
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
          <span>1. 文件上传与格式识别</span>
          <span>2. plan-write 生成任务计划</span>
          <span>3. coding-agent 执行任务</span>
          <span>4. 模板合成 Markdown / DOCX</span>
        </Card.Content>
      </Card>
    </section>
  );
}
