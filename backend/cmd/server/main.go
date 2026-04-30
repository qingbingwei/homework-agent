package main

import (
	"log"
	"net/http"
	"time"

	"github.com/qingbingwei/homework-agent/backend/internal/agent"
	"github.com/qingbingwei/homework-agent/backend/internal/config"
	transporthttp "github.com/qingbingwei/homework-agent/backend/internal/transporthttp"
)

const agentClientTimeout = 10 * time.Minute

func main() {
	cfg := config.Load()
	client := agent.NewClient(cfg.AgentServiceURL, &http.Client{Timeout: agentClientTimeout})
	handler := transporthttp.NewHandler(client, cfg)

	server := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
	}

	log.Printf("backend listening on http://localhost:%s", cfg.Port)
	log.Fatal(server.ListenAndServe())
}
