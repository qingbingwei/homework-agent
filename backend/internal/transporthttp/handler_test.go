package transporthttp

import (
	"bytes"
	"context"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/qingbingwei/homework-agent/backend/internal/agent"
	"github.com/qingbingwei/homework-agent/backend/internal/config"
	"github.com/qingbingwei/homework-agent/backend/internal/report"
)

type fakeAgentService struct{}
type failingAgentService struct{}

func (fakeAgentService) GenerateReport(_ context.Context, assignment agent.FilePayload, template agent.FilePayload) (report.Result, error) {
	return report.Result{
		FileName:         assignment.Name + "-report.docx",
		MarkdownContent:  "# report\n\ncontent",
		DocxBase64:       "Zm9v",
		TemplateStrategy: template.Name,
		Model:            "gpt-5.5",
	}, nil
}

func (fakeAgentService) Health(_ context.Context) (agent.HealthStatus, error) {
	return agent.HealthStatus{Status: "ok", Model: "gpt-5.5", AgentKeyConfigured: true}, nil
}

func (failingAgentService) GenerateReport(_ context.Context, _ agent.FilePayload, _ agent.FilePayload) (report.Result, error) {
	return report.Result{}, &agent.ServiceError{StatusCode: 500, Code: "internal_agent_error", Message: "LLM request failed (403): 当前可用额度不足", RequestID: "req-123", Stage: "generate_report"}
}

func (failingAgentService) Health(_ context.Context) (agent.HealthStatus, error) {
	return agent.HealthStatus{Status: "ok", Model: "gpt-5.5", AgentKeyConfigured: true}, nil
}

func TestHealthEndpoint(t *testing.T) {
	t.Parallel()

	handler := NewHandler(fakeAgentService{}, config.Load())
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/health", nil)

	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("unexpected status code: %d", recorder.Code)
	}

	var payload map[string]any
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("json decode error: %v", err)
	}
	if payload["status"] != "ok" {
		t.Fatalf("unexpected payload: %#v", payload)
	}
}

func TestCapabilitiesEndpoint(t *testing.T) {
	t.Parallel()

	handler := NewHandler(fakeAgentService{}, config.Load())
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/capabilities", nil)

	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("unexpected status code: %d", recorder.Code)
	}

	var payload map[string]any
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("json decode error: %v", err)
	}
	if payload["max_upload_bytes"] == nil {
		t.Fatalf("missing max upload bytes: %#v", payload)
	}
}

func TestGenerateReportEndpoint(t *testing.T) {
	t.Parallel()

	handler := NewHandler(fakeAgentService{}, config.Load())
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	writeTestFile(t, writer, "assignment", "homework.md", "# work")
	writeTestFile(t, writer, "template", "template.md", "# template")
	if err := writer.Close(); err != nil {
		t.Fatalf("close writer: %v", err)
	}

	request := httptest.NewRequest(http.MethodPost, "/api/report/generate", body)
	request.Header.Set("Content-Type", writer.FormDataContentType())
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("unexpected status code: %d body=%s", recorder.Code, recorder.Body.String())
	}

	var payload report.Result
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("json decode error: %v", err)
	}
	if payload.Model != "gpt-5.5" {
		t.Fatalf("unexpected model: %#v", payload)
	}
}

func TestGenerateReportEndpointErrorResponse(t *testing.T) {
	t.Parallel()

	handler := NewHandler(failingAgentService{}, config.Load())
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	writeTestFile(t, writer, "assignment", "homework.md", "# work")
	writeTestFile(t, writer, "template", "template.md", "# template")
	if err := writer.Close(); err != nil {
		t.Fatalf("close writer: %v", err)
	}

	request := httptest.NewRequest(http.MethodPost, "/api/report/generate", body)
	request.Header.Set("Content-Type", writer.FormDataContentType())
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusBadGateway {
		t.Fatalf("unexpected status code: %d body=%s", recorder.Code, recorder.Body.String())
	}

	var payload map[string]any
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("json decode error: %v", err)
	}
	if payload["code"] != "upstream_quota_exceeded" {
		t.Fatalf("unexpected error payload: %#v", payload)
	}
	if payload["request_id"] != "req-123" {
		t.Fatalf("unexpected error payload: %#v", payload)
	}
}

func writeTestFile(t *testing.T, writer *multipart.Writer, fieldName string, fileName string, content string) {
	t.Helper()
	part, err := writer.CreateFormFile(fieldName, fileName)
	if err != nil {
		t.Fatalf("create form file: %v", err)
	}
	if _, err = part.Write([]byte(content)); err != nil {
		t.Fatalf("write form file: %v", err)
	}
}
