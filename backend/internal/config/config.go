package config

import (
	"fmt"
	"os"
	"strconv"
	"time"
)

const defaultMaxUploadBytes int64 = 20 << 20
const defaultAgentClientTimeout = 30 * time.Minute
const defaultBackendPort = "19080"
const defaultAgentServiceURL = "http://localhost:19000"

type Config struct {
	Port               string
	AgentServiceURL    string
	AgentClientTimeout time.Duration
	FrontendDir        string
	MaxUploadBytes     int64
}

func Load() Config {
	return Config{
		Port:               getenv("BACKEND_PORT", defaultBackendPort),
		AgentServiceURL:    getenv("AGENT_SERVICE_URL", defaultAgentServiceURL),
		AgentClientTimeout: durationSeconds("AGENT_CLIENT_TIMEOUT_SECONDS", defaultAgentClientTimeout),
		FrontendDir:        getenv("FRONTEND_DIR", "../frontend/dist"),
		MaxUploadBytes:     defaultMaxUploadBytes,
	}
}

func getenv(key, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value
}

func durationSeconds(key string, fallback time.Duration) time.Duration {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	seconds, err := strconv.Atoi(value)
	if err != nil {
		panic(fmt.Sprintf("%s must be a positive integer second value: %q", key, value))
	}
	if seconds <= 0 {
		panic(fmt.Sprintf("%s must be greater than 0: %q", key, value))
	}
	return time.Duration(seconds) * time.Second
}
