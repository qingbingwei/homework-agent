# 修复端口配置与 coding-agent reasoning 参数

## Goal

修复 agent 默认端口仍为 8000、示例/本地 `.env` 未同步部署端口，以及 coding-agent 将 `xhigh` 转成 `max` 导致请求失败的问题。

## Scope

- 更新 agent 默认端口和 `.env.example` 端口。
- 修复 coding-agent reasoning 参数传递，保留 `xhigh`，不再静默改写为 `max`。
- 必要时同步本地 `agent/.env` 的端口行，不输出密钥。
- 运行类型检查/测试验证。

## Acceptance Criteria

- `agent/.env.example` 和本地 `agent/.env` 使用非常见端口 `19000`。
- `loadConfig()` 默认 agent 端口为 `19000`。
- coding-agent 请求参数中的 `reasoning_effort` 为配置值 `xhigh`。
- 自动验证通过或失败原因显式记录。
