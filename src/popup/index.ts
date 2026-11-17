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
  // Create the notification directly from the popup so it isn't delayed by the
  // MV3 service-worker cold start (sendMessage wakes the worker first, which can
  // add a second or more on a slow machine).
  chrome.notifications.create("tb-test", {
    type: "basic",
    iconUrl: "icons/icon128.png",
    title: "Toast Bridge",
    message: "Test notification — if you see this, the extension works.",
    priority: 0,
  });
});
$("options").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});
