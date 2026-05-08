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

type GenerateReportRequest struct {
	Assignment            FilePayload
	Template              FilePayload
	CodingModelProfile    string
	CodingReasoningEffort string
	CodingThinkingType    string
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

type ServiceError struct {
	StatusCode int    `json:"-"`
	Code       string `json:"code"`
	Message    string `json:"message"`
	RequestID  string `json:"request_id"`
	Stage      string `json:"stage"`
	RawBody    string `json:"-"`
}

func (e *ServiceError) Error() string {
	if e == nil {
		return "agent service error"
	}
	message := e.Message
	if message == "" {
		message = e.RawBody
	}
	if e.RequestID == "" {
		return fmt.Sprintf("agent service returned %d: %s", e.StatusCode, message)
	}
	return fmt.Sprintf("agent service returned %d [request_id=%s]: %s", e.StatusCode, e.RequestID, message)
}

func NewClient(baseURL string, httpClient *http.Client) *Client {
	return &Client{baseURL: baseURL, httpClient: httpClient}
}

func (c *Client) GenerateReport(ctx context.Context, payload GenerateReportRequest) (report.Result, error) {
	var result report.Result
	requestBody := &bytes.Buffer{}
	writer := multipart.NewWriter(requestBody)

	if err := writeFile(writer, "assignment", payload.Assignment); err != nil {
		return result, err
	}
	if err := writeFile(writer, "template", payload.Template); err != nil {
		return result, err
	}
	if err := writer.WriteField("coding_model_profile", payload.CodingModelProfile); err != nil {
		return result, err
	}
	if payload.CodingReasoningEffort != "" {
		if err := writer.WriteField("coding_reasoning_effort", payload.CodingReasoningEffort); err != nil {
			return result, err
		}
	}
	if payload.CodingThinkingType != "" {
		if err := writer.WriteField("coding_thinking_type", payload.CodingThinkingType); err != nil {
			return result, err
		}
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
		return result, buildServiceError(resp.StatusCode, body)
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return result, fmt.Errorf("decode agent response: %w", err)
	}
	return result, nil
}

func buildServiceError(statusCode int, body []byte) error {
	serviceError := &ServiceError{StatusCode: statusCode, RawBody: string(body)}
	if err := json.Unmarshal(body, serviceError); err == nil {
		if serviceError.Code != "" || serviceError.Message != "" || serviceError.RequestID != "" {
			return serviceError
		}
	}
	return serviceError
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
