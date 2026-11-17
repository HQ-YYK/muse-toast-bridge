// Toast Bridge — options page logic.

import { DEFAULT_SETTINGS } from "../shared/settings";

const $ = (id: string) => document.getElementById(id) as HTMLInputElement;

function load(): void {
  chrome.storage.sync.get(DEFAULT_SETTINGS, (items) => {
    $("enabled").checked = items.enabled;
    $("notifyDone").checked = items.notifyDone;
    $("notifyApproval").checked = items.notifyApproval;
    $("onlyWhenHidden").checked = items.onlyWhenHidden;
    $("minWorkingSeconds").value = String(items.minWorkingSeconds);
    $("workingSelectors").value = (items.workingSelectors || []).join("\n");
    $("approvalSelectors").value = (items.approvalSelectors || []).join("\n");
  });
}

function save(): void {
  const working = $("workingSelectors")
    .value.split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const approval = $("approvalSelectors")
    .value.split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  chrome.storage.sync.set(
    {
      enabled: $("enabled").checked,
      notifyDone: $("notifyDone").checked,
      notifyApproval: $("notifyApproval").checked,
      onlyWhenHidden: $("onlyWhenHidden").checked,
      minWorkingSeconds: Math.max(
        0,
        parseInt($("minWorkingSeconds").value, 10) || 0,
      ),
      workingSelectors: working,
      approvalSelectors: approval,
    },
    () => {
      const status = $("status");
      status.textContent = "Saved.";
      setTimeout(() => (status.textContent = ""), 2000);
    },
  );
}

document.addEventListener("DOMContentLoaded", load);
$("save").addEventListener("click", save);
$("test").addEventListener("click", () => {
  // Unique id + absolute icon URL + error capture (see popup for details).
  const id = `tb-test-${Date.now()}`;
  chrome.notifications.create(
    id,
    {
      type: "basic",
      iconUrl: chrome.runtime.getURL("icons/icon128.png"),
      title: "Toast Bridge",
      message: "Test notification — if you see this, the extension works.",
      priority: 0,
    },
    () => {
      if (chrome.runtime.lastError) {
        console.error("toast-bridge test notify failed:", chrome.runtime.lastError.message);
      }
    },
  );
});
