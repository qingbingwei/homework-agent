import { Button, Card, Chip, ScrollShadow } from "@heroui/react";

function ResultChips({ report }) {
  return (
    <div className="chip-grid">
      <Chip color="success" variant="soft">模板：{report.template_strategy}</Chip>
      <Chip variant="soft">Plan：{report.model}</Chip>
      <Chip variant="soft">Coding：{report.coding_model_profile || "gpt"} / {report.coding_model || "unknown"}</Chip>
    </div>
  );
}

export function ResultModule({ onDownloadDocx, onDownloadMarkdown, report }) {
  return (
    <section className="result-section" id="result">
      <div className="section-heading">
        <p className="eyebrow">Output</p>
        <h2>结果预览与下载</h2>
      </div>
      {!report ? (
        <Card className="module-card">
          <Card.Content className="empty-result">
            <strong>暂无生成结果</strong>
            <span>完成一次报告生成后，Markdown 预览和 DOCX 下载会显示在这里。</span>
          </Card.Content>
        </Card>
      ) : (
        <Card className="module-card result-card">
          <Card.Header>
            <div>
              <Card.Title>{report.file_name}</Card.Title>
              <Card.Description>报告已生成，可下载 Markdown 或 DOCX。</Card.Description>
            </div>
            <div className="button-row">
              <Button onPress={onDownloadMarkdown} variant="secondary">下载 Markdown</Button>
              <Button onPress={onDownloadDocx} variant="primary">下载 DOCX</Button>
            </div>
          </Card.Header>
          <Card.Content>
            <ResultChips report={report} />
            <ScrollShadow className="preview-shell">
              <pre>{report.markdown_content}</pre>
            </ScrollShadow>
          </Card.Content>
        </Card>
      )}
    </section>
  );
}
