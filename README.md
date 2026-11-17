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

Detection is heuristic on purpose — it does not depend on Muse's internal class
names, which change without notice. Two signals:

- **Task finished** — while Muse works, the composer's send button is replaced
  by a **Stop / "Stop generating"** button, and a generating/spinner indicator
  may be visible. The extension watches for that; when it has been visible for
  a while and then disappears (and stays gone 2s), the task is done.
- **Waiting for you** — Muse shows a decision card with buttons like **Allow /
  Ask / Deny / "Allow once" / "Always allow" / "Allow for this task"**, or the
  Chinese equivalents (允许 / 允许一次 / 总是允许此站点 / 审核 …). A visible
  approval button or an alert/decision dialog triggers the "waiting" ping.

Only tasks that ran at least 15 seconds notify, so short replies stay quiet. By
default it only pops when the Muse tab is **not** in focus. Both are adjustable.

If a Muse redesign breaks detection, add your own CSS selectors on the options
page ("Extra 'Muse is working' selectors" / "Extra 'Muse is waiting'
selectors") instead of waiting for a release.

Clicking a notification focuses the Muse tab it came from. Approval
notifications stay on screen until you dismiss them.

## Why not the Muse API?

Muse has **no public REST/SSE API** — its chat runs over an encrypted WebSocket
(`wss://hatch.metaaivm.com/v1/noise`, X25519 + HKDF + AES-GCM + Ed25519). There
is no supported way for an extension to poll task state without reimplementing
that protocol, so this extension stays purely DOM-based. (For reference, the
`Muse-Chat-MCP` project drives a real logged-in Chrome via Playwright for the
same reason.)

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
