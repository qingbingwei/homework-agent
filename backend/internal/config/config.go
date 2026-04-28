package config

import "os"

const defaultMaxUploadBytes int64 = 20 << 20

type Config struct {
	Port            string
	AgentServiceURL string
	FrontendDir     string
	MaxUploadBytes int64
}

func Load() Config {
	return Config{
		Port:            getenv("BACKEND_PORT", "8080"),
		AgentServiceURL: getenv("AGENT_SERVICE_URL", "http://localhost:8000"),
		FrontendDir:     getenv("FRONTEND_DIR", "../frontend/dist"),
		MaxUploadBytes:  defaultMaxUploadBytes,
	}
}

func getenv(key, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value
}
