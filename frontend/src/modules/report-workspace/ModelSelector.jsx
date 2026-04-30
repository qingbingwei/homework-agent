import { Card, Radio, RadioGroup } from "@heroui/react";

export function ModelSelector({ modelOptions, onModelChange, selectedCodingModel }) {
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
              <span>{option.label}</span>
              <small>{option.description}</small>
            </Radio>
          ))}
        </RadioGroup>
      </Card.Content>
    </Card>
  );
}
