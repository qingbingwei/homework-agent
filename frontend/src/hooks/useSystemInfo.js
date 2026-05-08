import { useEffect, useState } from "react";

import { fetchCapabilities, fetchHealth } from "../services/api";

const initialHealth = {
  status: "loading",
  message: "检查中...",
  meta: "正在连接后端与 Agent 服务",
  timeoutSeconds: 3600,
};

const initialCapabilities = {
  supported_formats: [],
  template_modes: [],
  docx_placeholders: [],
  coding_model_profiles: [],
  coding_reasoning_efforts: { deepseek: ["high", "max"] },
  coding_thinking_types: { deepseek: ["enabled", "disabled"] },
  max_upload_bytes: 0,
};

export function useSystemInfo() {
  const [health, setHealth] = useState(initialHealth);
  const [capabilities, setCapabilities] = useState(initialCapabilities);

  useEffect(() => {
    let active = true;

    const refreshHealth = async () => {
      try {
        const payload = await fetchHealth();
        if (!active) {
          return;
        }
        setHealth({
          status: payload.status,
          message: payload.status === "ok" ? "服务可用" : "服务异常",
          meta: `${payload.agent_url} · ${payload.model} · Agent ${payload.agent_status} · ${formatTimeout(payload.agent_client_timeout_seconds)}`,
          timeoutSeconds: payload.agent_client_timeout_seconds,
        });
      } catch (error) {
        if (!active) {
          return;
        }
        setHealth({ status: "error", message: "服务不可用", meta: error.message });
      }
    };

    const loadCapabilities = async () => {
      try {
        const payload = await fetchCapabilities();
        if (active) {
          setCapabilities(payload);
        }
      } catch {
        if (active) {
          setCapabilities(initialCapabilities);
        }
      }
    };

    refreshHealth();
    loadCapabilities();
    const timer = window.setInterval(refreshHealth, 15000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  return { health, capabilities };
}

function formatTimeout(seconds) {
  if (!seconds) return "timeout unknown";
  return `timeout ${Math.round(seconds / 60)} min`;
}
