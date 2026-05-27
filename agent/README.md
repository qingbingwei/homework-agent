# Homework Agent (TypeScript)

TypeScript 实现的 agent 服务，基于 Fastify + LangChain + LangGraph，使用 asxs 网关的 `gpt-5.5` 同时驱动 plan-write 与 coding-agent。通过 LangSmith 环境变量可开启链路追踪。

## 启动

```bash
cp .env.example .env   # 首次使用时填入真实 API Key
npm install
npm run dev
```

## 代码运行环境

默认使用容器执行生成的实验代码，避免依赖 agent 主机是否安装 Python、Node、Java 或 C/C++ 工具链。

```bash
docker build -t homework-agent-code-runtime:latest -f agent/docker/code-runtime/Dockerfile agent/docker/code-runtime
```

关键环境变量：

- `CODE_EXECUTION_BACKEND=container`：使用 Docker/Podman 容器执行代码。
- `CODE_CONTAINER_ENGINE=docker`：也可以设置为 `podman`。
- `CODE_CONTAINER_IMAGE=homework-agent-code-runtime:latest`：执行镜像。
- `CODE_CONTAINER_NETWORK=none`：默认禁用用户代码网络访问。

如果选择容器模式但 Docker/Podman 或镜像不可用，代码任务会明确失败，不会自动退回本机执行。开发调试时可显式设置 `CODE_EXECUTION_BACKEND=host`。

HTTP 契约与旧 Python agent 保持一致：

- `GET /health`：返回 `{status, model, agent_key_configured, base_url}`。
- `POST /generate-report`：multipart 上传 `assignment`、`template`，返回 `{file_name, markdown_content, docx_base64, template_strategy, model}`。
- 错误体：`{code, message, request_id, stage}`，并带 `X-Request-ID` 响应头。

## 目录

- `src/http/`：Fastify 入口、中间件、错误契约。
- `src/parsing/`：docx/pdf/markdown 解析。
- `src/templates/`：三种模板落地策略。
- `src/llm/`：ChatOpenAI 封装 + LangSmith tracing。
- `src/agents/`：LangGraph 状态图，拆分 plan-write / coding-agent。
- `src/agents/codingAgent/tools/`：沙箱内的 shell/file 工具。
