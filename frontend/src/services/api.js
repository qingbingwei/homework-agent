class ApiError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "ApiError";
    this.code = options.code || "unknown_error";
    this.source = options.source || "unknown";
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

export async function generateReport({ assignment, template }) {
  const formData = new FormData();
  formData.append("assignment", assignment);
  formData.append("template", template);

  const response = await fetch("/api/report/generate", {
    method: "POST",
    body: formData,
  });
  const okResponse = await ensureOk(response);
  return okResponse.json();
}
