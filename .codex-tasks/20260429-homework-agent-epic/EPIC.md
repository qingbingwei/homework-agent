# Epic Specification

## Goal

- 从零搭建一个全栈智能系统，支持上传学生作业与实验报告模板，调用独立 Python Agent 服务完成内容解析、作业解答与实验报告生成，并通过 Go 后端与前端完成交互闭环。

## Non-Goals

- 不实现用户登录、数据库持久化与多租户能力。
- 不在当前迭代中实现复杂的异步任务队列与分布式调度。

## Constraints

- 后端必须使用 Go。
- Agent 服务必须使用 Python。
- Agent 服务通过 OpenAI 兼容接口调用 `gpt-5.5`。
- 支持输入与模板格式：`.docx`、`.pdf`、`.md`。
- 输出至少包含 Markdown 报告与 `.docx` 报告。

## Risk Assessment

- PDF 与 DOCX 文本抽取质量受文档内容结构影响。
- 真实 LLM 调用依赖外部 API 可用性与环境变量配置。
- Word 模板的精准填充在无占位符时只能采用结构化追加策略。

## Child Deliverables

- 初始化仓库与任务工件。
- 实现 Python Agent 文档解析、模板处理与报告生成流程。
- 实现 Go 后端上传编排与结果返回接口。
- 实现前端上传界面与报告展示下载流程。
- 完成联调验证并提交 GitHub。

## Dependency Notes

- Go 后端依赖 Python Agent 服务 HTTP API。
- 前端依赖 Go 后端统一对外 API。

## Child Task Types

- `single-full`

## Done-When

- [ ] `SUBTASKS.csv` 全部为 `DONE`
- [ ] 前后端与 Agent 服务可本地启动
- [ ] 支持上传作业与模板并返回 Markdown / DOCX 报告
- [ ] 关键自动化验证通过

