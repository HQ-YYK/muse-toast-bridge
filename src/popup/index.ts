// Toast Bridge — popup logic (quick toggles + test button).

import { DEFAULT_SETTINGS } from "../shared/settings";

const $ = (id: string) => document.getElementById(id) as HTMLInputElement;

function load(): void {
  chrome.storage.sync.get(DEFAULT_SETTINGS, (items) => {
    $("enabled").checked = items.enabled;
    $("notifyDone").checked = items.notifyDone;
    $("notifyApproval").checked = items.notifyApproval;
  });
}

function save(): void {
  chrome.storage.sync.set({
    enabled: $("enabled").checked,
    notifyDone: $("notifyDone").checked,
    notifyApproval: $("notifyApproval").checked,
  });
}

document.addEventListener("DOMContentLoaded", load);
for (const id of ["enabled", "notifyDone", "notifyApproval"]) {
  $(id).addEventListener("change", save);
}
$("test").addEventListener("click", () => {
  try {
    const response = chrome.runtime.sendMessage({ type: "toast-bridge-test" }, () => {
      if (chrome.runtime.lastError) {
        console.error("toast-bridge test notify failed:", chrome.runtime.lastError.message);
      }
    }) as unknown;
    if (response && typeof (response as Promise<unknown>).catch === "function") {
      (response as Promise<unknown>).catch((error) => {
        console.error("toast-bridge test notify failed:", error);
      });
    }
  } catch (error) {
    console.error("toast-bridge test notify failed:", error);
  }
});
$("options").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});
