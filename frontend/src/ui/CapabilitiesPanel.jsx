function formatBytes(value) {
  if (!value) {
    return "未知";
  }
  const sizeInMb = value / (1024 * 1024);
  return `${sizeInMb.toFixed(0)} MB`;
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
        <article className="capability-card">
          <h3>支持格式</h3>
          <div className="chip-row">
            {capabilities.supported_formats.map((format) => (
              <span key={format}>{format}</span>
            ))}
          </div>
        </article>

        <article className="capability-card">
          <h3>模板策略</h3>
          <ul className="capability-list">
            {capabilities.template_modes.map((mode) => (
              <li key={mode}>{mode}</li>
            ))}
          </ul>
        </article>

        <article className="capability-card">
          <h3>DOCX 占位符</h3>
          <ul className="capability-list">
            {capabilities.docx_placeholders.map((placeholder) => (
              <li key={placeholder}>{placeholder}</li>
            ))}
          </ul>
        </article>

        <article className="capability-card">
          <h3>上传限制</h3>
          <p className="capability-value">单次请求最大 {formatBytes(capabilities.max_upload_bytes)}</p>
        </article>
      </div>
    </section>
  );
}

