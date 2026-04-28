export function ReportResult({ report, onDownloadMarkdown, onDownloadDocx }) {
  if (!report) {
    return null;
  }

  return (
    <section className="panel-card">
      <div className="result-header">
        <div>
          <p className="eyebrow">生成结果</p>
          <h2>{report.file_name}</h2>
        </div>
        <div className="button-row">
          <button className="secondary-button" onClick={onDownloadMarkdown} type="button">
            下载 Markdown
          </button>
          <button className="primary-button" onClick={onDownloadDocx} type="button">
            下载 DOCX
          </button>
        </div>
      </div>

      <div className="chip-row">
        <span>模板策略：{report.template_strategy}</span>
        <span>模型：{report.model}</span>
      </div>

      <pre className="preview-card">{report.markdown_content}</pre>
    </section>
  );
}

