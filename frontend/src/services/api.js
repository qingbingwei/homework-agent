class ApiError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "ApiError";
    this.code = options.code || "unknown_error";
    this.source = options.source || "unknown";
    this.requestId = options.request_id || "";
    this.stage = options.stage || "";
  }
}

const ensureOk = async (response) => {
  if (response.ok) {
    return response;
  }
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const payload = await response.json();
    throw new ApiError(payload.message || "请求失败", payload);
  }
  const message = await response.text();
  throw new ApiError(message || "请求失败");
};

export async function fetchHealth() {
  const response = await fetch("/api/health");
  const okResponse = await ensureOk(response);
  return okResponse.json();
}

export async function fetchCapabilities() {
  const response = await fetch("/api/capabilities");
  const okResponse = await ensureOk(response);
  return okResponse.json();
}

export async function generateReport({ assignment, template, codingModelProfile }) {
  const formData = new FormData();
  formData.append("assignment", assignment);
  formData.append("template", template);
  formData.append("coding_model_profile", codingModelProfile || "gpt");

  const response = await fetch("/api/report/generate", {
    method: "POST",
    body: formData,
  });
  const okResponse = await ensureOk(response);
  return okResponse.json();
}
