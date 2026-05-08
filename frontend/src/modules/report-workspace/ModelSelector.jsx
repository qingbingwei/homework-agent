import { Card, Chip, Radio, RadioGroup } from "@heroui/react";

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
    <Card className="module-card">
      <Card.Header>
        <div>
          <p className="eyebrow">Model profile</p>
          <Card.Title>Coding Agent 模型</Card.Title>
          <Card.Description>选择执行任务拆解与代码推理的模型。</Card.Description>
        </div>
      </Card.Header>
      <Card.Content>
        <RadioGroup
          aria-label="Coding Agent 模型"
          className="model-radio-group"
          onChange={onModelChange}
          value={selectedCodingModel}
          variant="secondary"
        >
          {modelOptions.map((option) => (
            <Radio key={option.value} value={option.value}>
              <span className="model-option-title">
                {option.label}
                <Chip size="sm" variant="soft">{option.value}</Chip>
              </span>
              <small>{option.description}</small>
            </Radio>
          ))}
        </RadioGroup>
        <div className="reasoning-control">
          <div className="reasoning-control-heading">
            <strong>推理等级</strong>
            <Chip size="sm" variant="soft">{isDeepSeek ? selectedCodingReasoningEffort : "xhigh"}</Chip>
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
            <small>GPT coding agent 固定使用 xhigh，不提供手动选择。</small>
          )}
        </div>
      </Card.Content>
    </Card>
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
    <div className="deepseek-control-stack">
      <RadioGroup
        aria-label="DeepSeek 推理等级"
        className="reasoning-radio-group"
        onChange={onReasoningChange}
        orientation="horizontal"
        value={selectedCodingReasoningEffort}
        variant="secondary"
      >
        {reasoningOptions.map((effort) => (
          <Radio key={effort} value={effort}>{effort}</Radio>
        ))}
      </RadioGroup>
      <button
        aria-checked={thinkingEnabled}
        className="thinking-switch"
        onClick={() => onThinkingChange(thinkingEnabled ? "disabled" : "enabled")}
        role="switch"
        type="button"
      >
        <span className="switch-track"><span className="switch-thumb" /></span>
        <span>{thinkingEnabled ? "Thinking 已开启" : "Thinking 已关闭"}</span>
      </button>
    </div>
  );
}
