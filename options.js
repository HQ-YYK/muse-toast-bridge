// Toast Bridge — options page logic.

const DEFAULTS = {
  enabled: true,
  notifyDone: true,
  notifyApproval: true,
  onlyWhenHidden: true,
  minWorkingSeconds: 15,
  workingSelectors: [],
};

const $ = (id) => document.getElementById(id);

function load() {
  chrome.storage.sync.get(DEFAULTS, (items) => {
    $("enabled").checked = items.enabled;
    $("notifyDone").checked = items.notifyDone;
    $("notifyApproval").checked = items.notifyApproval;
    $("onlyWhenHidden").checked = items.onlyWhenHidden;
    $("minWorkingSeconds").value = items.minWorkingSeconds;
    $("workingSelectors").value = (items.workingSelectors || []).join("\n");
  });
}

function save() {
  const selectors = $("workingSelectors")
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
        parseInt($("minWorkingSeconds").value, 10) || 0
      ),
      workingSelectors: selectors,
    },
    () => {
      const status = $("status");
      status.textContent = "Saved.";
      setTimeout(() => (status.textContent = ""), 2000);
    }
  );
}

document.addEventListener("DOMContentLoaded", load);
$("save").addEventListener("click", save);
$("test").addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "toast-bridge-test" });
});
