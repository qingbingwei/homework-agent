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

type HealthStatus struct {
	Status             string `json:"status"`
	Model              string `json:"model"`
	AgentKeyConfigured bool   `json:"agent_key_configured"`
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

func (c *Client) Health(ctx context.Context) (HealthStatus, error) {
	var status HealthStatus
	endpoint := strings.TrimRight(c.baseURL, "/") + "/health"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return status, fmt.Errorf("create health request: %w", err)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return status, fmt.Errorf("call agent health: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return status, fmt.Errorf("read agent health: %w", err)
	}
	if resp.StatusCode >= http.StatusBadRequest {
		return status, fmt.Errorf("agent health returned %s: %s", resp.Status, string(body))
	}
	if err := json.Unmarshal(body, &status); err != nil {
		return status, fmt.Errorf("decode agent health: %w", err)
	}
	return status, nil

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
