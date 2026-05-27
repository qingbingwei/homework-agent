import { Chip } from "@heroui/react";

const MODEL_META = {
  gpt: {
    badge: "GPT",
    accent: "from-[#10b981] to-[#0d9488]",
    description: "gpt-5.5 · 强逻辑 · 长上下文",
  },
  deepseek: {
    badge: "DS",
    accent: "from-[#f97316] to-[#ea580c]",
    description: "deepseek-v4-pro · 深度推理 · 可调思考",
  },
};

function ModelCard({ option, selected, onSelect }) {
  const meta = MODEL_META[option.value] || { badge: option.value.slice(0, 2).toUpperCase(), accent: "from-[#0d9488] to-[#14b8a6]", description: option.description };
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      data-selected={selected}
      onClick={() => onSelect(option.value)}
      className="ha-radio-card text-left cursor-pointer"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className={`grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br ${meta.accent} text-white text-[12px] font-extrabold shadow-[0_6px_14px_-6px_rgba(13,148,136,0.55)]`}>
            {meta.badge}
          </span>
          <strong className="text-[14px] font-bold text-[var(--brand-ink)]">{option.label}</strong>
        </div>
        <Chip size="sm" variant="soft">{option.value}</Chip>
      </div>
      <small className="text-[12px] leading-relaxed text-[var(--muted)]">{meta.description}</small>
    </button>
  );
}

function ReasoningPill({ effort, selected, onSelect }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={() => onSelect(effort)}
      className={`ha-toggle-pill cursor-pointer ${selected ? "" : ""}`}
      style={selected ? undefined : undefined}
    >
      <span className="text-[12px] font-semibold capitalize">{effort}</span>
    </button>
  );
}

function DeepSeekControls({
  onReasoningChange,
  onThinkingChange,
  reasoningOptions,
  selectedCodingReasoningEffort,
  selectedCodingThinkingType,
}) {
  const thinkingEnabled = selectedCodingThinkingType === "enabled";
  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">推理强度</span>
        <div className="flex flex-wrap gap-2">
          {reasoningOptions.map((effort) => (
            <ReasoningPill
              key={effort}
              effort={effort}
              selected={effort === selectedCodingReasoningEffort}
              onSelect={onReasoningChange}
            />
          ))}
        </div>
      </div>

      <div className="grid gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">Thinking 模式</span>
        <button
          aria-checked={thinkingEnabled}
          className="ha-toggle-pill w-full justify-between cursor-pointer"
          onClick={() => onThinkingChange(thinkingEnabled ? "disabled" : "enabled")}
          role="switch"
          type="button"
        >
          <span className="text-[12px] font-semibold">
            {thinkingEnabled ? "Thinking 已开启" : "Thinking 已关闭"}
          </span>
          <span className="ha-toggle-pill__track">
            <span className="ha-toggle-pill__thumb" />
          </span>
        </button>
      </div>
    </div>
  );
}

export function ModelSelector({
  modelOptions,
  onModelChange,
  onReasoningChange,
  onThinkingChange,
  reasoningOptions,
  selectedCodingReasoningEffort,
  selectedCodingModel,
  selectedCodingThinkingType,
}) {
  const isDeepSeek = selectedCodingModel === "deepseek";

  return (
    <div className="ha-glass-card grid h-full gap-5 p-7">
      <div className="grid gap-1">
        <p className="ha-eyebrow">Model profile</p>
        <h3 className="m-0 text-[17px] font-bold leading-tight text-[var(--brand-ink)]">
          Coding Agent 模型
        </h3>
        <p className="m-0 text-[12px] leading-relaxed text-[var(--muted)]">
          选择执行任务拆解与代码推理的模型 profile。
        </p>
      </div>

      <div role="radiogroup" aria-label="Coding Agent 模型" className="grid gap-2.5">
        {modelOptions.map((option) => (
          <ModelCard
            key={option.value}
            option={option}
            selected={option.value === selectedCodingModel}
            onSelect={onModelChange}
          />
        ))}
      </div>

      <div className="grid gap-3 border-t border-[rgba(15,23,42,0.06)] pt-4">
        <div className="flex items-center justify-between">
          <strong className="text-[13px] font-bold text-[var(--brand-ink)]">推理等级</strong>
          <Chip size="sm" variant="soft" color={isDeepSeek ? "success" : "default"}>
            {isDeepSeek ? selectedCodingReasoningEffort : "xhigh"}
          </Chip>
        </div>
        {isDeepSeek ? (
          <DeepSeekControls
            onReasoningChange={onReasoningChange}
            onThinkingChange={onThinkingChange}
            reasoningOptions={reasoningOptions}
            selectedCodingReasoningEffort={selectedCodingReasoningEffort}
            selectedCodingThinkingType={selectedCodingThinkingType}
          />
        ) : (
          <div className="rounded-xl bg-[rgba(13,148,136,0.06)] p-3 text-[12px] leading-relaxed text-[var(--muted)]">
            GPT coding agent 固定使用 <strong className="text-[var(--brand-ink)]">xhigh</strong>，不提供手动选择。
          </div>
        )}
      </div>
    </div>
  );
}
