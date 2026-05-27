import { Chip, ProgressBar } from "@heroui/react";

const pipelineSteps = [
  { label: "文件识别", desc: "解析 Word / PDF / Markdown" },
  { label: "计划生成", desc: "Planner 拆解写作蓝图" },
  { label: "Agent 执行", desc: "Coding Agent 推理产出" },
  { label: "报告合成", desc: "Markdown + DOCX 双格式" },
];

function StatusPill({ health }) {
  const ok = health.status === "ok";
  const loading = health.status === "loading";
  const dotClass = ok ? "ha-status-dot--ok" : loading ? "ha-status-dot--loading" : "ha-status-dot--err";
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(15,23,42,0.06)] bg-white/70 px-3 py-1.5 backdrop-blur">
      <span className={`ha-status-dot ${dotClass}`} />
      <span className="text-[12px] font-semibold text-[var(--brand-ink)]">{health.message}</span>
    </div>
  );
}

function Metric({ label, value, hint }) {
  return (
    <div className="ha-metric">
      <span className="ha-metric__label">{label}</span>
      <strong className="ha-metric__value">{value}</strong>
      {hint ? <span className="ha-metric__hint">{hint}</span> : null}
    </div>
  );
}

function PipelineList() {
  return (
    <ol className="m-0 grid list-none gap-2 p-0">
      {pipelineSteps.map((step, index) => (
        <li key={step.label} className="ha-pipeline-step">
          <span className="ha-pipeline-step__index">{index + 1}</span>
          <div className="grid min-w-0 gap-0.5">
            <strong className="text-[13px] font-bold leading-tight text-[var(--brand-ink)]">{step.label}</strong>
            <span className="truncate text-[12px] text-[var(--muted)]">{step.desc}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function OverviewModule({ capabilities, health, selectedCodingModel }) {
  const formatCount = capabilities.supported_formats.length || 3;
  const modelCount = capabilities.coding_model_profiles.length || 2;

  return (
    <section
      className="grid grid-cols-12 gap-6 max-[1080px]:grid-cols-1"
      id="overview"
    >
      {/* Hero panel */}
      <div className="ha-glass-card col-span-7 grid h-full gap-6 p-7 max-[1080px]:col-span-1">
        <div className="flex items-start justify-between gap-4 max-[640px]:flex-col">
          <div className="grid gap-2">
            <p className="ha-eyebrow">AI Lab Report Workspace</p>
            <h1 className="m-0 text-[26px] font-extrabold leading-tight tracking-tight text-[var(--brand-ink)] max-[640px]:text-[22px]">
              实验报告生成控制台
            </h1>
            <p className="m-0 max-w-xl text-[14px] leading-relaxed text-[var(--muted)]">
              端到端处理作业解析、任务计划、代码执行与模板合成。让 AI Agent 自动完成实验报告写作的全部流程。
            </p>
          </div>
          <StatusPill health={health} />
        </div>

        <div className="grid grid-cols-3 gap-3 max-[640px]:grid-cols-1">
          <Metric label="Coding Agent" value={selectedCodingModel.toUpperCase()} hint="当前激活模型" />
          <Metric label="支持格式" value={formatCount} hint="docx · pdf · md" />
          <Metric label="模型配置" value={modelCount} hint="可切换 profile" />
        </div>

        <div className="mt-auto flex items-center gap-3 border-t border-[rgba(15,23,42,0.06)] pt-5 max-[640px]:flex-col max-[640px]:items-stretch">
          <a
            className="ha-cta-btn inline-flex h-10 items-center justify-center px-5 text-sm font-bold cursor-pointer"
            href="#workspace"
          >
            开始生成 →
          </a>
          <a
            className="ha-ghost-btn inline-flex h-10 items-center justify-center px-4 text-sm font-semibold"
            href="#system"
          >
            查看系统状态
          </a>
        </div>
      </div>

      {/* Timeline panel */}
      <div className="ha-glass-card col-span-5 grid h-full gap-4 p-6 max-[1080px]:col-span-1">
        <div className="grid gap-1">
          <p className="ha-eyebrow">Pipeline</p>
          <h3 className="m-0 text-[17px] font-bold leading-tight text-[var(--brand-ink)]">
            生成链路
          </h3>
          <p className="m-0 truncate text-[12px] text-[var(--muted)]">
            {health.meta || "实时跟踪 Agent 处理进度"}
          </p>
        </div>

        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold text-[var(--brand-ink)]">就绪度</span>
            <Chip size="sm" variant="soft" color={health.status === "ok" ? "success" : "warning"}>
              {health.status === "ok" ? "在线" : "等待"}
            </Chip>
          </div>
          <ProgressBar
            aria-label="生成链路就绪度"
            value={health.status === "ok" ? 100 : 60}
            color="success"
          />
        </div>

        <PipelineList />
      </div>
    </section>
  );
}
