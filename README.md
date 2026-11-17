# Toast Bridge — browser extension

A Chrome extension (Manifest V3, also works in Edge and Brave) that watches
[muse.ai](https://muse.ai/) in your browser and pops a system notification when
Muse finishes a long task or waits for your approval.

This is the no-listener way to use Toast Bridge: if you talk to Muse in the
browser, you don't need the PowerShell listener at all. The extension and the
listener solve the same problem from opposite ends — the listener takes pushes
from any agent, the extension watches the Muse tab.

## Install (load unpacked)

1. Open `chrome://extensions`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and select this `browser-extension/` folder.
4. Open [muse.ai](https://muse.ai/) and keep the tab open.

No build step. Chrome Web Store listing is not published yet; loading unpacked
is the install method for now.

## How it detects things

The extension does not depend on Muse's internal class names or DOM structure,
which change without notice. It uses two heuristics:

- **Task finished:** while Muse is working, the send button is replaced by a
  Stop button. The extension watches for that Stop button; when it has been
  visible for a while and then disappears (and stays gone for 2 seconds), the
  task is done.
- **Waiting for you:** a button whose whole label is an approval word
  (Approve / Allow / Confirm / 批准 / 允许 / 确认) appears, or an alert dialog
  opens.

Only tasks that ran at least 15 seconds notify, so short replies stay quiet.
By default it only pops when the Muse tab is not in focus — if you are already
watching, you don't need a popup. Both are adjustable on the options page.

Clicking a notification focuses the Muse tab it came from. Approval
notifications stay on screen until you dismiss them.

## Settings

Click the extension icon for quick toggles, or open its options page for:

- Enable / disable, per-event toggles (finish / approval)
- Only notify when the tab is not in focus
- Minimum task length before a finish notifies
- Extra "Muse is working" CSS selectors — if a Muse update breaks detection,
  put the selector of the working indicator (spinner, stop button) here
  instead of waiting for a new release
- A test notification button

## Limitations

- The Muse tab must be open and Chrome must be running. It cannot notify
  about work done in the Muse app or on another device — use the PowerShell
  listener for that.
- Detection is heuristic. If Muse redesigns the composer, the Stop-button
  signal may change; add a selector in options, or file an issue.

## Files

| File | What it does |
| ---- | ------------ |
| `manifest.json` | Extension manifest (MV3, permissions, content script) |
| `content.js` | Watches muse.ai, detects finish / approval |
| `background.js` | Service worker, shows notifications, focuses tabs |
| `options.html` / `options.js` | Settings page |
| `popup.html` / `popup.js` | Toolbar popup with quick toggles |
| `icons/` | Extension icons (16 / 48 / 128 px) |

## Privacy

The extension runs only on `muse.ai`, stores its settings in
`chrome.storage.sync`, and sends nothing anywhere. Notifications are created
locally with the `notifications` API.
