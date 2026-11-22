# 任务书 copilot-02：删除 CRX 自动更新 + 更新 README + 升版本 1.2.0

执行者：VS Code Copilot（Agent 模式）
基线分支：`fix/detection`
任务分支：`copilot/cleanup-docs`（从 `fix/detection` 切出）

## 只允许改动这些文件

| 文件 | 操作 |
| :--- | :--- |
| `updates.xml` | 删除（`git rm`） |
| `scripts/release.mjs` | 删除（`git rm`） |
| `package.json` | 改 |
| `src/manifest.ts` | 改 |
| `README.md` | 改 |

**不要碰**：`src/` 下除 `manifest.ts` 以外的任何文件、`scripts/zip.mjs`、`.gitignore`、`pnpm-lock.yaml`、`legacy/`、`tasks/`。
**不要删** 仓库根目录的 `key.pem`、`dist.pem` 和 `release/` 目录（它们不在 git 里，是否删除由用户决定）。

## 1. 删除 CRX 自动更新

原因：Windows 上的 Chrome/Edge 不允许安装商店以外的 CRX（企业策略除外），用户实际用的是"加载已解压的扩展程序"，自动更新用不上。

- `src/manifest.ts`：删掉 `update_url` 那一行和它上面的 3 行注释。
- `package.json`：删掉 `release`、`release:patch`、`release:minor`、`release:major` 四个脚本。保留 `dev`、`build`、`build:zip`、`typecheck`。
- `git rm updates.xml scripts/release.mjs`

## 2. 版本号 1.1.0 → 1.2.0

- `package.json` 的 `version`
- `src/manifest.ts` 的 `version`

## 3. 更新 README.md

### 3.1 改写 "How it detects things" 整节

旧内容描述的是 Stop 按钮和 Allow/Ask/Deny 词表，已经不符合实现。按下面的事实重写，用英文，风格与 README 其他部分一致，不要添加下面没有的内容：

- **Working**：页面上有可见元素的 class 含 `status-working`（还认 `status-running`、`status-thinking`、`status-generating`、`status-in-progress`）。兼容旧布局：Stop / "Stop generating" / 停止 按钮，或短于 30 字符的 spinner/status 文字（如 "Thinking…"、生成中）。
- **Finished**：一段 working 结束且保持空闲 2 秒，报一次"完成"，耗时是真实的工作时长。工作过程中出现的 `status-success` 步骤气泡忽略。空闲时出现新的 `status-success` 气泡（没观察到工作阶段，例如被折叠）也报一次。
- **Waiting for you**：一个 `data-copy-exclude` 容器里至少有 2 个 `border-dashed` 选项按钮（Muse 让你选下一步时的卡片）；或者按钮文字是 Allow / Allow once / Always allow / Allow for this task / 允许 / 允许一次 / 总是允许 等授权类词。不再匹配 Confirm / Ask / Deny / 确认 / 拒绝 或任意 `role="dialog"`，因为普通弹窗也有这些。
- **Only new things count**：聊天记录会保留所有旧气泡和已回答的卡片。页面加载、切换对话、修改选择器后，扩展把当前页面上已有的元素记为基线，之后只对新出现、且是页面上同类中最靠下的元素反应。Muse 的聊天列表会在滚动时重新挂载旧消息，"最靠下"这条规则让它们不会误报。
- 一个"waiting"通知之后 15 秒内的"done"会合并，不再单独弹。
- 保留原有段落：只有工作满 15 秒的任务才通知；默认只在 Muse 标签页不在前台时通知；两者都可在选项页调整；Muse 改版时可在选项页加自定义选择器。
- 保留原有段落：点击通知会聚焦来源标签页，审批通知会一直留在屏幕上直到关闭。补一句：标签页 ID 编码在通知 ID 里，所以浏览器回收 Service Worker 之后点击仍然有效。

### 3.2 新增 "Debugging" 一节（放在 "Settings" 之前）

内容要点：

- 打开一次 `https://muse.ai/?tbdebug`，调试模式会存进该站点的 localStorage 并一直生效（站内切换页面不会丢）；`?tbdebug=0` 关闭。
- 控制台过滤框输入 `toast-bridge` 只看扩展日志。
- 列出日志含义（原文照抄这些 key）：`started`、`baseline taken`、`working started`、`done`、`finished bubble during work (step), ignored`、`new approval prompt`、`done merged into the waiting alert just sent`、`suppressed (tab focused)`。每个一句话说明。

### 3.3 "Project layout" 表格

- 加一行：`tasks/` — Task briefs for Copilot (Agent mode)。
- 检查表里没有提到 `release.mjs`、`updates.xml`；如有则删掉。

## 代码风格

- 只做上面列出的改动，不重排 README 其他章节，不改措辞风格。
- 不要加 emoji、徽章、目录。

## 验收（你自己先跑）

```bash
npm run build                     # 0 错误
grep -rn "update_url\|updates.xml\|release.mjs" --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.pnpm-store --exclude-dir=tasks .
                                  # 应无输出
```

再打开 `dist/manifest.json`，确认 `version` 是 `1.2.0`、没有 `update_url`。

## 提交

- 一次提交，message：`chore: drop CRX auto-update, document new detection, bump 1.2.0`
- 不要提交 `dist/`。不要合并到 `fix/detection` 或 `main`，不要推送。提交完告诉用户分支名，由 Claude 审查。
