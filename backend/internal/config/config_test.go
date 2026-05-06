package config

import (
	"testing"
	"time"
)

func TestLoadAgentClientTimeoutDefault(t *testing.T) {
	t.Setenv("AGENT_CLIENT_TIMEOUT_SECONDS", "")

	cfg := Load()

	if cfg.AgentClientTimeout != time.Hour {
		t.Fatalf("unexpected default timeout: %s", cfg.AgentClientTimeout)
	}
}

func TestLoadAgentClientTimeoutOverride(t *testing.T) {
	t.Setenv("AGENT_CLIENT_TIMEOUT_SECONDS", "7200")

	cfg := Load()

	if cfg.AgentClientTimeout != 2*time.Hour {
		t.Fatalf("unexpected timeout override: %s", cfg.AgentClientTimeout)
	}
}

func TestLoadAgentClientTimeoutRejectsInvalidValue(t *testing.T) {
	t.Setenv("AGENT_CLIENT_TIMEOUT_SECONDS", "abc")

	defer func() {
		if recover() == nil {
			t.Fatal("expected invalid timeout to panic")
		}
	}()

	_ = Load()
}
