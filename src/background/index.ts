// Toast Bridge — background service worker.
//
// Receives "notify" messages from the content script and shows a native
// system notification via chrome.notifications. Clicking a notification
// focuses the tab it came from. "need" (approval) notifications stay on
// screen until dismissed; "done" notifications use the system default timeout.

import { DEFAULT_SETTINGS } from "../shared/settings";

// Fill in any missing settings without clobbering what the user set.
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(DEFAULT_SETTINGS, (items) => {
    chrome.storage.sync.set({ ...DEFAULT_SETTINGS, ...items });
  });
});

function showNotification(
  kind: "done" | "need",
  title: string,
  body: string,
  tabId?: number,
): void {
  const id = `tb-${tabId ?? "x"}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  chrome.notifications.create(id, {
    type: "basic",
    iconUrl: chrome.runtime.getURL("icons/icon128.png"),
    title,
    message: body,
    priority: kind === "need" ? 2 : 0,
    requireInteraction: kind === "need",
  }, () => {
    if (chrome.runtime.lastError) {
      console.error("toast-bridge notify failed:", chrome.runtime.lastError.message);
    }
  });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const m = msg as { type?: string; kind?: string; title?: string; body?: string };
  if (m && m.type === "toast-bridge-notify") {
    showNotification(
      m.kind === "need" ? "need" : "done",
      m.title ?? "Toast Bridge",
      m.body ?? "",
      sender.tab?.id,
    );
  } else if (m && m.type === "toast-bridge-test") {
    showNotification(
      "done",
      "Toast Bridge",
      "Test notification — if you see this, the extension works.",
      sender.tab?.id,
    );
    // Reply so the caller's callback doesn't see "message port closed".
    sendResponse({ ok: true });
  }
});

chrome.notifications.onClicked.addListener((id) => {
  const tabIdPart = id.split("-")[1];
  const tabId = Number(tabIdPart);
  if (Number.isInteger(tabId) && tabId >= 0) {
    chrome.tabs.update(tabId, { active: true }, (tab) => {
      if (chrome.runtime.lastError) {
        return;
      }
      if (tab && tab.windowId !== undefined) {
        chrome.windows.update(tab.windowId, { focused: true }, () => {
          if (chrome.runtime.lastError) {
            // Window may have closed before the focus update.
          }
        });
      }
    });
  }
  chrome.notifications.clear(id);
});
