import { Chip, ScrollShadow, Separator } from "@heroui/react";

function ResultChips({ report }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Chip color="success" variant="soft">模板：{report.template_strategy}</Chip>
      <Chip variant="soft">Plan：{report.model}</Chip>
      <Chip variant="soft">Coding：{report.coding_model_profile || "gpt"} / {report.coding_model || "unknown"}</Chip>
    </div>
  );
}

function EmptyResultState() {
  return (
    <div className="ha-glass-card grid min-h-[220px] place-items-center p-8 text-center">
      <div className="grid gap-3 place-items-center">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[rgba(13,148,136,0.10)]">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--brand-primary)]">
            <path d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
          </svg>
        </span>
        <strong className="text-[15px] font-bold text-[var(--brand-ink)]">暂无生成结果</strong>
        <span className="max-w-xs text-[12px] leading-relaxed text-[var(--muted)]">
          完成一次报告生成后，Markdown 预览和 DOCX 下载将显示在这里。
        </span>
      </div>
    </div>
  );
}

export function ResultModule({ onDownloadDocx, onDownloadMarkdown, report }) {
  return (
    <section className="grid gap-4" id="result">
      <div className="grid gap-1">
        <p className="ha-eyebrow">Output</p>
        <h2 className="m-0 text-[20px] font-extrabold leading-tight text-[var(--brand-ink)]">
          结果预览与下载
        </h2>
      </div>

      {!report ? (
        <EmptyResultState />
      ) : (
        <div className="ha-glass-card grid gap-5 p-7">
          <div className="flex items-start justify-between gap-4 max-[640px]:flex-col">
            <div className="grid min-w-0 gap-1.5">
              <h3 className="m-0 truncate text-[17px] font-bold text-[var(--brand-ink)]">{report.file_name}</h3>
              <p className="m-0 text-[12px] text-[var(--muted)]">报告已生成，可下载 Markdown 或 DOCX。</p>
            </div>
            <div className="flex flex-shrink-0 items-center gap-2.5 max-[640px]:w-full">
              <button
                className="ha-ghost-btn inline-flex h-9 items-center justify-center px-4 text-[13px] font-semibold cursor-pointer max-[640px]:flex-1"
                onClick={onDownloadMarkdown}
                type="button"
              >
                下载 Markdown
              </button>
              <button
                className="ha-cta-btn inline-flex h-9 items-center justify-center px-4 text-[13px] font-bold cursor-pointer max-[640px]:flex-1"
                onClick={onDownloadDocx}
                type="button"
              >
                下载 DOCX
              </button>
            </div>
          </div>

          <ResultChips report={report} />

          <Separator />

          <div className="ha-preview">
            <div className="ha-preview__bar">
              <span>Markdown Preview</span>
              <span>{report.markdown_content.length} chars</span>
            </div>
            <ScrollShadow className="max-h-[480px]">
              <pre className="ha-preview__body">{report.markdown_content}</pre>
            </ScrollShadow>
          </div>
        </div>
      )}
    </section>
  );
}
