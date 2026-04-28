package transporthttp

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/qingbingwei/homework-agent/backend/internal/agent"
	"github.com/qingbingwei/homework-agent/backend/internal/config"
)

type Handler struct {
	agentClient    *agent.Client
	config         config.Config
	staticFileServer http.Handler
}

type healthResponse struct {
	Status             string `json:"status"`
	AgentURL           string `json:"agent_url"`
	AgentStatus        string `json:"agent_status"`
	Model              string `json:"model"`
	AgentKeyConfigured bool   `json:"agent_key_configured"`
}

func NewHandler(agentClient *agent.Client, cfg config.Config) http.Handler {
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
	if r.URL.Path == "/api/report/generate" && r.Method == http.MethodPost {
		h.handleGenerateReport(w, r)
		return
	}
	h.staticFileServer.ServeHTTP(w, r)
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
		http.Error(w, fmt.Sprintf("invalid multipart form: %v", err), http.StatusBadRequest)
		return
	}

	assignment, err := readUploadedFile(r, "assignment")
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	template, err := readUploadedFile(r, "template")
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	result, err := h.agentClient.GenerateReport(r.Context(), assignment, template)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
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

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, h.config.AgentServiceURL+"/health", nil)
	if err != nil {
		return "invalid-health-endpoint", false
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "unreachable", false
	}
	defer resp.Body.Close()

	var payload struct {
		Status             string `json:"status"`
		AgentKeyConfigured bool   `json:"agent_key_configured"`
	}
	if err = json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return "invalid-response", false
	}
	if payload.Status == "" {
		return "unknown", payload.AgentKeyConfigured
	}
	return payload.Status, payload.AgentKeyConfigured
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
