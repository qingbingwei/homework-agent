package transporthttp

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/qingbingwei/homework-agent/backend/internal/agent"
	"github.com/qingbingwei/homework-agent/backend/internal/config"
	"github.com/qingbingwei/homework-agent/backend/internal/report"
)

var supportedFormats = []string{".docx", ".pdf", ".md"}
var docxPlaceholders = []string{"{{REPORT_TITLE}}", "{{REPORT_BODY}}"}

type agentService interface {
	GenerateReport(context.Context, agent.FilePayload, agent.FilePayload) (report.Result, error)
	Health(context.Context) (agent.HealthStatus, error)
}

type Handler struct {
	agentClient      agentService
	config           config.Config
	staticFileServer http.Handler
}

type healthResponse struct {
	Status             string `json:"status"`
	AgentURL           string `json:"agent_url"`
	AgentStatus        string `json:"agent_status"`
	Model              string `json:"model"`
	AgentKeyConfigured bool   `json:"agent_key_configured"`
}

type capabilitiesResponse struct {
	SupportedFormats []string `json:"supported_formats"`
	TemplateModes    []string `json:"template_modes"`
	DocxPlaceholders []string `json:"docx_placeholders"`
	MaxUploadBytes   int64    `json:"max_upload_bytes"`
}

type errorResponse struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Source  string `json:"source"`
	RequestID string `json:"request_id,omitempty"`
	Stage string `json:"stage,omitempty"`
}

func NewHandler(agentClient agentService, cfg config.Config) http.Handler {
	frontendDir := resolveFrontendDir(cfg.FrontendDir)
	return &Handler{
		agentClient:       agentClient,
		config:            cfg,
		staticFileServer:  http.FileServer(http.Dir(frontendDir)),
	}
}

func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	setCORSHeaders(w)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if r.URL.Path == "/api/health" {
		h.handleHealth(w)
		return
	}
	if r.URL.Path == "/api/capabilities" {
		h.handleCapabilities(w)
		return
	}
	if r.URL.Path == "/api/report/generate" && r.Method == http.MethodPost {
		h.handleGenerateReport(w, r)
		return
	}
	h.staticFileServer.ServeHTTP(w, r)
}

func (h *Handler) handleCapabilities(w http.ResponseWriter) {
	writeJSON(w, http.StatusOK, capabilitiesResponse{
		SupportedFormats: supportedFormats,
		TemplateModes:    []string{"docx-xml-placeholder", "reference-docx", "pandoc-generated"},
		DocxPlaceholders: docxPlaceholders,
		MaxUploadBytes:   h.config.MaxUploadBytes,
	})
}

func (h *Handler) handleHealth(w http.ResponseWriter) {
	agentStatus, agentKeyConfigured := h.fetchAgentStatus()
	writeJSON(w, http.StatusOK, healthResponse{
		Status:             "ok",
		AgentURL:           h.config.AgentServiceURL,
		AgentStatus:        agentStatus,
		Model:              "gpt-5.5",
		AgentKeyConfigured: agentKeyConfigured,
	})
}

func (h *Handler) handleGenerateReport(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(h.config.MaxUploadBytes); err != nil {
		writeErrorJSON(w, http.StatusBadRequest, "invalid_multipart_form", "backend", fmt.Sprintf("invalid multipart form: %v", err))
		return
	}

	assignment, err := readUploadedFile(r, "assignment")
	if err != nil {
		writeErrorJSON(w, http.StatusBadRequest, "invalid_assignment", "backend", err.Error())
		return
	}
	template, err := readUploadedFile(r, "template")
	if err != nil {
		writeErrorJSON(w, http.StatusBadRequest, "invalid_template", "backend", err.Error())
		return
	}

	result, err := h.agentClient.GenerateReport(r.Context(), assignment, template)
	if err != nil {
		writeGenerateError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func readUploadedFile(r *http.Request, field string) (agent.FilePayload, error) {
	file, header, err := r.FormFile(field)
	if err != nil {
		return agent.FilePayload{}, fmt.Errorf("missing %s file: %w", field, err)
	}
	defer file.Close()

	content, err := io.ReadAll(file)
	if err != nil {
		return agent.FilePayload{}, fmt.Errorf("read %s file: %w", field, err)
	}
	return agent.FilePayload{
		Name:        header.Filename,
		ContentType: detectContentType(header),
		Data:        content,
	}, nil
}

func detectContentType(header *multipart.FileHeader) string {
	if len(header.Header.Values("Content-Type")) > 0 {
		return header.Header.Get("Content-Type")
	}
	return "application/octet-stream"
}

func resolveFrontendDir(configured string) string {
	if filepath.IsAbs(configured) {
		return configured
	}
	workingDir, err := os.Getwd()
	if err != nil {
		return configured
	}
	return filepath.Clean(filepath.Join(workingDir, configured))
}

func (h *Handler) fetchAgentStatus() (string, bool) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	status, err := h.agentClient.Health(ctx)
	if err != nil {
		return "unreachable", false
	}
	if status.Status == "" {
		return "unknown", status.AgentKeyConfigured
	}
	return status.Status, status.AgentKeyConfigured
}

func setCORSHeaders(w http.ResponseWriter) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	w.Header().Set("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
}

func writeJSON(w http.ResponseWriter, statusCode int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	_ = json.NewEncoder(w).Encode(payload)
}

func writeErrorJSON(w http.ResponseWriter, statusCode int, code string, source string, message string) {
	writeJSON(w, statusCode, errorResponse{Code: code, Message: message, Source: source})
}

func writeGenerateError(w http.ResponseWriter, err error) {
	var serviceErr *agent.ServiceError
	if errors.As(err, &serviceErr) {
		code := serviceErr.Code
		classifiedCode := classifyUpstreamError(serviceErr.Error())
		if classifiedCode == "upstream_quota_exceeded" || code == "" {
			code = classifiedCode
		}
		writeJSON(w, http.StatusBadGateway, errorResponse{
			Code: code,
			Message: serviceErr.Error(),
			Source: "agent",
			RequestID: serviceErr.RequestID,
			Stage: serviceErr.Stage,
		})
		return
	}
	writeErrorJSON(w, http.StatusBadGateway, classifyUpstreamError(err.Error()), "agent", err.Error())
}

func classifyUpstreamError(message string) string {
	if strings.Contains(message, "insufficient_quota") || strings.Contains(message, "额度不足") {
		return "upstream_quota_exceeded"
	}
	return "upstream_generation_failed"
}
