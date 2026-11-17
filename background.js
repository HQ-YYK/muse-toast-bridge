// Toast Bridge — background service worker.
//
// Receives "notify" messages from the content script and shows a system
// notification. Clicking a notification focuses the tab it came from.
// "need" (approval) notifications stay on screen until dismissed;
// "done" notifications use the system default timeout.

const DEFAULTS = {
  enabled: true,
  notifyDone: true,
  notifyApproval: true,
  onlyWhenHidden: true,
  minWorkingSeconds: 15,
  workingSelectors: [],
};

// Fill in any missing settings without clobbering what the user set.
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(DEFAULTS, (items) => {
    chrome.storage.sync.set({ ...DEFAULTS, ...items });
  });
});

// notificationId -> tabId, so a click can focus the right tab.
const tabByNotification = new Map();

function showNotification(kind, title, body, tabId) {
  const id = `tb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  if (tabId) tabByNotification.set(id, tabId);
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
  if (msg && msg.type === "toast-bridge-notify") {
    showNotification(msg.kind, msg.title, msg.body, sender.tab && sender.tab.id);
  } else if (msg && msg.type === "toast-bridge-test") {
    showNotification(
      "done",
      "Toast Bridge",
      "Test notification — if you see this, the extension works.",
      sender.tab && sender.tab.id
    );
  }
});

chrome.notifications.onClicked.addListener((id) => {
  const tabId = tabByNotification.get(id);
  if (tabId) {
    chrome.tabs.update(tabId, { active: true }, (tab) => {
      if (tab && tab.windowId) {
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
