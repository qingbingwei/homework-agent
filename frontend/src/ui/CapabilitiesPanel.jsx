function formatBytes(value) {
  if (!value) {
    return "未知";
  }
  const sizeInMb = value / (1024 * 1024);
  return `${sizeInMb.toFixed(0)} MB`;
}

function formatProfile(profile) {
  if (profile === "gpt") {
    return "GPT";
  }
  if (profile === "deepseek") {
    return "DeepSeek";
  }
  return profile;
}

function ChipCard({ title, values, formatter = (value) => value }) {
  return (
    <article className="capability-card">
      <h3>{title}</h3>
      <div className="chip-row">
        {values.map((value) => (
          <span key={value}>{formatter(value)}</span>
        ))}
      </div>
    </article>
  );
}

function ListCard({ title, values }) {
  return (
    <article className="capability-card">
      <h3>{title}</h3>
      <ul className="capability-list">
        {values.map((value) => (
          <li key={value}>{value}</li>
        ))}
      </ul>
    </article>
  );
}

export function CapabilitiesPanel({ capabilities }) {
  return (
    <section className="panel-card">
      <div className="panel-header">
        <div>
          <p className="eyebrow">系统能力</p>
          <h2>当前支持的输入与模板策略</h2>
        </div>
      </div>

      <div className="capability-grid">
        <ChipCard title="支持格式" values={capabilities.supported_formats} />
        <ListCard title="模板策略" values={capabilities.template_modes} />
        <ListCard title="DOCX 占位符" values={capabilities.docx_placeholders} />

        <article className="capability-card">
          <h3>上传限制</h3>
          <p className="capability-value">单次请求最大 {formatBytes(capabilities.max_upload_bytes)}</p>
        </article>

        <ChipCard title="Coding Agent" values={capabilities.coding_model_profiles} formatter={formatProfile} />
      </div>
    </section>
  );
}
