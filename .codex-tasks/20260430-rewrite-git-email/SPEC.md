# SPEC

任务: 批量修复本地 Git 仓库历史提交邮箱

目标:
- 基于用户提供的 `git filter-branch --env-filter` 思路，新增可复用脚本。
- 脚本遍历本地仓库，按旧邮箱命中 author/committer 后改写为新用户名和新邮箱。
- 默认 dry-run，不执行历史重写或 force push。
- `.codex/` 已在 `.gitignore` 中忽略，不纳入提交。

安全边界:
- `--execute` 才允许改写本地历史。
- `--push` 必须和 `--execute` 一起使用，才会执行 `git push --force --all` 与 `git push --force --tags`。
- dirty worktree 直接失败，避免覆盖未保存修改。
- 可用 `--owner` 限制 GitHub owner，避免改写非本人仓库。
