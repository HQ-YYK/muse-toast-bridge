# 任务书 copilot-01：后台通知点击跳转 + 测试按钮去重

执行者：VS Code Copilot（Agent 模式）
基线分支：`fix/detection`
任务分支：`copilot/background-notify`（从 `fix/detection` 切出）

## 只允许改这三个文件

- `src/background/index.ts`
- `src/popup/index.ts`
- `src/options/index.ts`

**不要碰** `src/content/`、`src/shared/`、`src/manifest.ts`、`vite.config.ts`、`package.json`。不要加依赖。

## 问题 1：点击通知跳不回 Muse 标签页

`src/background/index.ts` 把"通知 ID → 标签页 ID"存在内存 `Map` 里。MV3 的 Service Worker 空闲约 30 秒就被回收，Map 随之清空。审批通知 `requireInteraction: true` 会一直挂着，用户几分钟后点它时映射已经没了，点击无反应。

要求：

1. 删掉 `tabByNotification` 这个 Map。
2. 把标签页 ID 编进通知 ID：有 tabId 时用 `tb-<tabId>-<时间戳>-<随机串>`，没有时用 `tb-x-<时间戳>-<随机串>`。
3. `onClicked` 里从 ID 解析 tabId（`id.split("-")[1]`，用 `Number()` 转换，`Number.isInteger` 校验，不合法就跳过跳转）。
4. 跳转时用 `chrome.tabs.update(tabId, { active: true })` 加 `chrome.windows.update(windowId, { focused: true })`；标签页已关闭时 `chrome.runtime.lastError` 会有值，读一下它防止控制台报 "Unchecked runtime.lastError"，然后静默结束。
5. 无论跳转成功与否，最后都 `chrome.notifications.clear(id)`。
6. `onClosed` 监听器只为清 Map 存在，Map 删了它也一起删。

## 问题 2：测试通知代码重复三份

`popup/index.ts` 和 `options/index.ts` 各自复制了一份 `chrome.notifications.create(...)`，和 background 里的逻辑重复。

要求：

1. popup 和 options 的 "Test notification" 按钮改为发消息：`chrome.runtime.sendMessage({ type: "toast-bridge-test" })`。background 已经处理这个消息类型，不用新增。
2. 删掉两个页面里的 `chrome.notifications.create` 调用。
3. 发消息失败时（`chrome.runtime.lastError` 或 Promise reject）在控制台 `console.error`，不要弹 alert。

## 代码风格

- 英文注释，简洁，不加 docstring。
- 保持现有的回调风格（`chrome.xxx(..., callback)`），不要整体改成 async/await。

## 验收（你自己先跑一遍）

```bash
npm run build      # 必须 0 错误
```

然后手动测：

1. `chrome://extensions` 重新加载 `dist/`。
2. 点 popup 的 Test notification，能弹通知。
3. 在 options 页点 Test notification，能弹通知。
4. 打开 muse.ai，触发一条审批通知（它会一直挂着），切到别的标签页，不操作等 1 分钟让 Service Worker 休眠（`chrome://serviceworker-internals` 能看到状态变成 STOPPED；注意别开着 SW 的 DevTools，开着它不会休眠），再点通知，能跳回 muse.ai 标签页。

## 提交

- 一次提交即可，message：`fix(background): encode tabId in notification id; route test button via background`
- 只提交上面三个文件，不要提交 `dist/`。
- 不要合并到 `fix/detection` 或 `main`，不要推送。提交完告诉用户分支名，由 Claude 审查后合并。
