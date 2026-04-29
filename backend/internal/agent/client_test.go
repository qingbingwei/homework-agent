package agent

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestGenerateReport(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/generate-report" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"file_name":"report.docx","markdown_content":"# ok","docx_base64":"Zm9v","template_strategy":"reference-docx","model":"gpt-5.5"}`))
	}))
	defer server.Close()

	client := NewClient(server.URL, &http.Client{Timeout: time.Second})
	result, err := client.GenerateReport(context.Background(), FilePayload{Name: "hw.md", ContentType: "text/markdown", Data: []byte("a")}, FilePayload{Name: "template.md", ContentType: "text/markdown", Data: []byte("b")})
	if err != nil {
		t.Fatalf("GenerateReport returned error: %v", err)
	}
	if result.FileName != "report.docx" {
		t.Fatalf("unexpected file name: %s", result.FileName)
	}
}

func TestHealth(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/health" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"status":"ok","model":"gpt-5.5","agent_key_configured":true}`))
	}))
	defer server.Close()

	client := NewClient(server.URL, &http.Client{Timeout: time.Second})
	status, err := client.Health(context.Background())
	if err != nil {
		t.Fatalf("Health returned error: %v", err)
	}
	if status.Model != "gpt-5.5" {
		t.Fatalf("unexpected model: %s", status.Model)
	}
}

func TestGenerateReportReturnsStructuredServiceError(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte(`{"code":"internal_agent_error","message":"boom","request_id":"req-123","stage":"generate_report"}`))
	}))
	defer server.Close()

	client := NewClient(server.URL, &http.Client{Timeout: time.Second})
	_, err := client.GenerateReport(context.Background(), FilePayload{Name: "hw.md", ContentType: "text/markdown", Data: []byte("a")}, FilePayload{Name: "template.md", ContentType: "text/markdown", Data: []byte("b")})
	serviceErr, ok := err.(*ServiceError)
	if !ok {
		t.Fatalf("expected ServiceError, got %T", err)
	}
	if serviceErr.RequestID != "req-123" {
		t.Fatalf("unexpected request id: %#v", serviceErr)
	}
}
