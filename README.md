# Toast Bridge — browser extension

A Chrome/Edge extension (Manifest V3) that watches [muse.ai](https://muse.ai/)
and pops a **native system notification** when Muse finishes a long task or
waits for your approval. No account, no server, nothing leaves your machine.

> **What is Muse?** `muse.ai` is Meta's personal AI agent (also called
> "Hatch"). It runs tasks in a **cloud browser** and pauses to ask you to
> approve actions (allow a site, confirm an upload, etc.) via decision cards.
> This extension watches that page and pings you when something needs you —
> the same job as the Claude Code / Codex browser-notification extensions, but
> for Muse.

## Project layout (source)

This is a **source project** (TypeScript + Vite + CRXJS), not a hand-written
bundle. Build output goes to `dist/`, which is what you "Load unpacked".

| Path | What it is |
| ---- | ---------- |
| `src/manifest.ts` | Manifest V3 definition (typed) |
| `src/shared/settings.ts` | Settings schema + defaults (single source of truth) |
| `src/background/index.ts` | Service worker: shows notifications, focuses tabs |
| `src/content/index.ts` | Watches muse.ai, drives the detectors |
| `src/content/working.ts` | "Muse is working" detection |
| `src/content/approval.ts` | "Muse is waiting" detection |
| `src/content/dom.ts` | DOM helpers |
| `src/popup/` | Toolbar popup (quick toggles) |
| `src/options/` | Options page |
| `icons/` | Extension icons |
| `scripts/zip.mjs` | Build a distributable zip |
| `tasks/` | Task briefs for Copilot (Agent mode) |
| `legacy/` | The original flat-file version (kept for reference) |

## Develop

```bash
pnpm install      # or npm install
pnpm dev          # Vite dev server with HMR (for development)
pnpm build        # typecheck + production build into dist/
pnpm build:zip    # build + zip into release/
```

Then open `chrome://extensions`, enable **Developer mode**, and **Load
unpacked** → select the `dist/` folder.

> Note: this repo uses `node-linker=hoisted` (see `.npmrc`) to work around a
> pnpm-on-Windows symlink failure.

## How it detects things

- **Working** — the extension recognizes a visible element whose class contains
  `status-working`, plus `status-running`, `status-thinking`,
  `status-generating`, or `status-in-progress`. For older layouts, it also
  recognizes a Stop / "Stop generating" / 停止 button, or spinner/status text
  shorter than 30 characters (such as "Thinking…" or 生成中).
- **Finished** — after a working period ends and the page stays idle for 2
  seconds, the extension reports one completion with the real duration of the
  working period. `status-success` step bubbles that appear during work are
  ignored. A new `status-success` bubble that appears while idle (for example,
  when no work phase was observed because it was collapsed) reports one
  completion as well.
- **Waiting for you** — the extension recognizes a card when a
  `data-copy-exclude` container contains at least two `border-dashed` option
  buttons, or when the button text is an approval phrase such as Allow, Allow
  once, Always allow, Allow for this task, 允许, 允许一次, or 总是允许. It no
  longer matches Confirm, Ask, Deny, 确认, or 拒绝, and it does not match
  arbitrary `role="dialog"` elements.
- **Only new things count** — chat history retains old bubbles and answered
  cards. After page load, conversation switches, or selector changes, the
  extension records the elements currently on the page as a baseline. It only
  reacts to new elements that are the lowest matching element of their kind on
  the page. Muse may remount old messages as the chat list scrolls, but the
  lowest-element rule prevents false reports.
- A waiting notification is merged with a done notification that arrives within
  15 seconds, so only the waiting alert remains.

Only tasks that ran at least 15 seconds notify, so short replies stay quiet. By
default it only pops when the Muse tab is **not** in focus. Both are adjustable
on the options page.

If a Muse redesign breaks detection, add your own CSS selectors on the options
page ("Extra 'Muse is working' selectors" / "Extra 'Muse is waiting'
selectors") instead of waiting for a release.

Clicking a notification focuses the Muse tab it came from. Approval
notifications stay on screen until you dismiss them. The tab ID is encoded in
the notification ID, so clicking one still works after the browser recycles the
Service Worker.

## Why not the Muse API?

Muse has **no public REST/SSE API** — its chat runs over an encrypted WebSocket
(`wss://hatch.metaaivm.com/v1/noise`, X25519 + HKDF + AES-GCM + Ed25519). There
is no supported way for an extension to poll task state without reimplementing
that protocol, so this extension stays purely DOM-based. (For reference, the
`Muse-Chat-MCP` project drives a real logged-in Chrome via Playwright for the
same reason.)

## Debugging

Open `https://muse.ai/?tbdebug` once to enable debug logging. The setting is
stored in that site's localStorage, so it remains enabled while navigating
between pages on the site. Open `https://muse.ai/?tbdebug=0` to disable it.

In the browser console, filter by `toast-bridge` to show only extension logs.
The log keys have these meanings:

- `started` — the content script has initialized.
- `baseline taken` — existing page elements were recorded as the baseline.
- `working started` — Muse started a working period.
- `done` — a task finished. Logged even when the run was shorter than the
  minimum length; only longer runs notify.
- `finished bubble during work (step), ignored` — a success step bubble appeared
  during work and was ignored.
- `new approval prompt` — a new waiting-for-you prompt was detected.
- `done merged into the waiting alert just sent` — the task finished within
  15 seconds of a waiting alert, so no separate done notification was shown.
- `suppressed (tab focused)` — a notification was not shown because the Muse
  tab was in focus.

## Settings

Click the extension icon for quick toggles, or open its options page for:

- Enable / disable, per-event toggles (finish / approval)
- Only notify when the tab is not in focus
- Minimum task length before a finish notifies
- Extra "Muse is working" / "Muse is waiting" CSS selectors (escape hatch)
- A test notification button

## Limitations

- The Muse tab must be open and the browser running. It cannot notify about
  work done in the Muse mobile/desktop apps.
- Detection is heuristic; if Muse redesigns the composer or approval cards, add
  a selector in options or file an issue.

## Privacy

Runs only on `muse.ai` (and subdomains), stores settings in
`chrome.storage.sync`, and sends nothing anywhere. Notifications are created
locally with the `notifications` API.
