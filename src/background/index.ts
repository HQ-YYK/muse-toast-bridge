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

// notificationId -> tabId, so a click can focus the right tab.
const tabByNotification = new Map<string, number>();

function showNotification(
  kind: "done" | "need",
  title: string,
  body: string,
  tabId?: number,
): void {
  const id = `tb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  if (tabId !== undefined) tabByNotification.set(id, tabId);
  chrome.notifications.create(id, {
    type: "basic",
    iconUrl: "icons/icon128.png",
    title,
    message: body,
    priority: kind === "need" ? 2 : 0,
    requireInteraction: kind === "need",
  });
}

chrome.runtime.onMessage.addListener((msg, sender) => {
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
  }
});

chrome.notifications.onClicked.addListener((id) => {
  const tabId = tabByNotification.get(id);
  if (tabId !== undefined) {
    chrome.tabs.update(tabId, { active: true }, (tab) => {
      if (tab && tab.windowId !== undefined) {
        chrome.windows.update(tab.windowId, { focused: true });
      }
    });
  }
  chrome.notifications.clear(id);
  tabByNotification.delete(id);
});

chrome.notifications.onClosed.addListener((id) => {
  tabByNotification.delete(id);
});
