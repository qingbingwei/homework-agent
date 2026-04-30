import { Card, Chip } from "@heroui/react";

import { formatModelProfile } from "../../lib/modelProfiles";

function formatBytes(value) {
  if (!value) return "未知";
  return `${(value / (1024 * 1024)).toFixed(0)} MB`;
}

function ChipGroup({ values, formatter = (value) => value }) {
  return (
    <div className="chip-grid">
      {values.map((value) => (
        <Chip key={value} variant="soft">
          {formatter(value)}
        </Chip>
      ))}
    </div>
  );
}

function ListBlock({ title, values }) {
  return (
    <Card className="module-card">
      <Card.Header>
        <Card.Title>{title}</Card.Title>
      </Card.Header>
      <Card.Content>
        <ul className="system-list">
          {values.map((value) => (
            <li key={value}>{value}</li>
          ))}
        </ul>
      </Card.Content>
    </Card>
  );
}

export function SystemModule({ capabilities, health }) {
  return (
    <section className="system-section" id="system">
      <div className="section-heading">
        <p className="eyebrow">System capability</p>
        <h2>运行状态与能力边界</h2>
      </div>
      <div className="system-grid">
        <Card className="module-card">
          <Card.Header>
            <Card.Title>服务状态</Card.Title>
            <Card.Description>{health.meta}</Card.Description>
          </Card.Header>
          <Card.Content className="status-grid">
            <span>后端状态</span>
            <strong>{health.message}</strong>
            <span>上传限制</span>
            <strong>{formatBytes(capabilities.max_upload_bytes)}</strong>
          </Card.Content>
        </Card>
        <Card className="module-card">
          <Card.Header>
            <Card.Title>Coding Agent Profiles</Card.Title>
          </Card.Header>
          <Card.Content>
            <ChipGroup values={capabilities.coding_model_profiles} formatter={formatModelProfile} />
          </Card.Content>
        </Card>
        <ListBlock title="模板策略" values={capabilities.template_modes} />
        <ListBlock title="DOCX 占位符" values={capabilities.docx_placeholders} />
      </div>
    </section>
  );
}
