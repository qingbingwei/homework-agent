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

