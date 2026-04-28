const saveBlob = (blob, fileName) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
};

const decodeBase64 = (value) => {
  const binary = window.atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

export function downloadMarkdown(report) {
  const name = report.file_name.replace(/\.docx$/u, ".md");
  saveBlob(new Blob([report.markdown_content], { type: "text/markdown;charset=utf-8" }), name);
}

export function downloadDocx(report) {
  const payload = decodeBase64(report.docx_base64);
  saveBlob(
    new Blob([payload], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }),
    report.file_name,
  );
}

