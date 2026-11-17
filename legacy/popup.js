// Toast Bridge — popup logic (quick toggles + test button).

const DEFAULTS = {
  enabled: true,
  notifyDone: true,
  notifyApproval: true,
};

const $ = (id) => document.getElementById(id);

function load() {
  chrome.storage.sync.get(DEFAULTS, (items) => {
    $("enabled").checked = items.enabled;
    $("notifyDone").checked = items.notifyDone;
    $("notifyApproval").checked = items.notifyApproval;
  });
}

function save() {
  chrome.storage.sync.set({
    enabled: $("enabled").checked,
    notifyDone: $("notifyDone").checked,
    notifyApproval: $("notifyApproval").checked,
  });
}

document.addEventListener("DOMContentLoaded", load);
["enabled", "notifyDone", "notifyApproval"].forEach((id) => {
  $(id).addEventListener("change", save);
});
$("test").addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "toast-bridge-test" });
});
$("options").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});
