package report

type Result struct {
	FileName              string `json:"file_name"`
	MarkdownContent       string `json:"markdown_content"`
	DocxBase64            string `json:"docx_base64"`
	TemplateStrategy      string `json:"template_strategy"`
	Model                 string `json:"model"`
	CodingModelProfile    string `json:"coding_model_profile"`
	CodingModel           string `json:"coding_model"`
	CodingReasoningEffort string `json:"coding_reasoning_effort"`
	CodingThinkingType    string `json:"coding_thinking_type"`
}
