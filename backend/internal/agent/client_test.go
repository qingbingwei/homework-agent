package agent

import (
	"context"
	"io"
	"mime/multipart"
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
		profile := readMultipartField(t, r, "coding_model_profile")
		if profile != "deepseek" {
			t.Fatalf("unexpected coding model profile: %s", profile)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"file_name":"report.docx","markdown_content":"# ok","docx_base64":"Zm9v","template_strategy":"reference-docx","model":"gpt-5.5"}`))
	}))
	defer server.Close()

	client := NewClient(server.URL, &http.Client{Timeout: time.Second})
	result, err := client.GenerateReport(context.Background(), GenerateReportRequest{
		Assignment:         FilePayload{Name: "hw.md", ContentType: "text/markdown", Data: []byte("a")},
		Template:           FilePayload{Name: "template.md", ContentType: "text/markdown", Data: []byte("b")},
		CodingModelProfile: "deepseek",
	})
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
	_, err := client.GenerateReport(context.Background(), GenerateReportRequest{
		Assignment:         FilePayload{Name: "hw.md", ContentType: "text/markdown", Data: []byte("a")},
		Template:           FilePayload{Name: "template.md", ContentType: "text/markdown", Data: []byte("b")},
		CodingModelProfile: "gpt",
	})
	serviceErr, ok := err.(*ServiceError)
	if !ok {
		t.Fatalf("expected ServiceError, got %T", err)
	}
	if serviceErr.RequestID != "req-123" {
		t.Fatalf("unexpected request id: %#v", serviceErr)
	}
}

func readMultipartField(t *testing.T, r *http.Request, name string) string {
	t.Helper()
	reader, err := r.MultipartReader()
	if err != nil {
		t.Fatalf("multipart reader: %v", err)
	}
	for {
		part, err := reader.NextPart()
		if err != nil {
			t.Fatalf("read multipart field %s: %v", name, err)
		}
		if part.FormName() == name {
			return readPartValue(t, part)
		}
	}
}

func readPartValue(t *testing.T, part *multipart.Part) string {
	t.Helper()
	data, err := io.ReadAll(part)
	if err != nil {
		t.Fatalf("read multipart value: %v", err)
	}
	return string(data)
}
