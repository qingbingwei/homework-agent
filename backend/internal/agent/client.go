package agent

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"strings"

	"github.com/qingbingwei/homework-agent/backend/internal/report"
)

type FilePayload struct {
	Name        string
	ContentType string
	Data        []byte
}

type Client struct {
	baseURL    string
	httpClient *http.Client
}

func NewClient(baseURL string, httpClient *http.Client) *Client {
	return &Client{baseURL: baseURL, httpClient: httpClient}
}

func (c *Client) GenerateReport(ctx context.Context, assignment FilePayload, template FilePayload) (report.Result, error) {
	var result report.Result
	requestBody := &bytes.Buffer{}
	writer := multipart.NewWriter(requestBody)

	if err := writeFile(writer, "assignment", assignment); err != nil {
		return result, err
	}
	if err := writeFile(writer, "template", template); err != nil {
		return result, err
	}
	if err := writer.Close(); err != nil {
		return result, fmt.Errorf("close multipart writer: %w", err)
	}

	endpoint := strings.TrimRight(c.baseURL, "/") + "/generate-report"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, requestBody)
	if err != nil {
		return result, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return result, fmt.Errorf("call agent service: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return result, fmt.Errorf("read agent response: %w", err)
	}
	if resp.StatusCode >= http.StatusBadRequest {
		return result, fmt.Errorf("agent service returned %s: %s", resp.Status, string(body))
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return result, fmt.Errorf("decode agent response: %w", err)
	}
	return result, nil
}

func writeFile(writer *multipart.Writer, fieldName string, file FilePayload) error {
	part, err := writer.CreateFormFile(fieldName, file.Name)
	if err != nil {
		return fmt.Errorf("create multipart field %s: %w", fieldName, err)
	}
	if _, err = part.Write(file.Data); err != nil {
		return fmt.Errorf("write multipart field %s: %w", fieldName, err)
	}
	return nil
}
