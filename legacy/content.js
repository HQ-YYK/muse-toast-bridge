// Toast Bridge — content script for muse.ai
//
// Watches the Muse web app and tells the background worker when:
//   - a task finishes ("done"): a "working" indicator was visible for a while,
//     then disappeared and stayed gone for a short settle period.
//   - Muse waits for the user ("need"): an approval prompt appears.
//
// Detection is heuristic on purpose: it does not depend on Muse's internal
// class names or DOM structure, which change without notice. If a future
// Muse update breaks detection, add a CSS selector for the working indicator
// on the options page instead of waiting for a new release.

(() => {
  if (window.__toastBridgeLoaded) return;
  window.__toastBridgeLoaded = true;

  const DEFAULTS = {
    enabled: true,
    notifyDone: true,
    notifyApproval: true,
    // Only pop when you are NOT looking at the tab. If you are watching
    // Muse work, you don't need a popup telling you it finished.
    onlyWhenHidden: true,
    // Minimum run length (seconds) before a finish is worth a popup.
    // Short replies don't notify; long tasks do.
    minWorkingSeconds: 15,
    // Extra CSS selectors (one per line in options) that mean "Muse is
    // working" when a visible element matches, e.g. a spinner or stop button.
    workingSelectors: [],
  };

  let settings = { ...DEFAULTS };
  try {
    chrome.storage.sync.get(DEFAULTS, (items) => {
      settings = { ...DEFAULTS, ...items };
    });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "sync") return;
      for (const [key, change] of Object.entries(changes)) {
        settings[key] = change.newValue;
      }
    });
  } catch (e) {
    // Storage unavailable (e.g. in tests): keep defaults.
  }

  // Words that appear on approval buttons, matched exactly (case-insensitive)
  // so we don't fire on ordinary buttons that merely contain them.
  const APPROVAL_WORDS = ["approve", "allow", "confirm", "批准", "允许", "确认"];

  function isVisible(el) {
    if (!el || !(el instanceof Element)) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;
    const style = window.getComputedStyle(el);
    return style.display !== "none" && style.visibility !== "hidden";
  }

  function buttonLabel(el) {
    return (
      el.getAttribute("aria-label") ||
      el.getAttribute("title") ||
      (el.textContent || "")
    ).trim();
  }

  // --- "Muse is working" detection -------------------------------------
  // Primary signal: a visible Stop button. Chat apps replace the send
  // button with a stop button while generating; its disappearance is the
  // most reliable cross-version "finished" signal available.
  function hasStopButton() {
    const buttons = document.querySelectorAll('button, [role="button"]');
    for (const el of buttons) {
      if (!isVisible(el)) continue;
      const label = buttonLabel(el);
      if (label.length > 40) continue;
      if (/^stop( generating)?$/i.test(label) || label === "停止") return true;
    }
    return false;
  }

  function hasCustomWorkingIndicator() {
    const selectors = settings.workingSelectors || [];
    for (const sel of selectors) {
      if (!sel || typeof sel !== "string") continue;
      try {
        const el = document.querySelector(sel);
        if (el && isVisible(el)) return true;
      } catch (e) {
        // Bad selector from options: ignore it, don't break the scan.
      }
    }
    return false;
  }

  function isWorking() {
    return hasStopButton() || hasCustomWorkingIndicator();
  }

  // --- approval detection ----------------------------------------------
  // A visible button whose whole label is an approval word, or a newly
  // appeared alert dialog. Each element notifies at most once.
  const seenApprovalNodes = new WeakSet();
  let lastApprovalAt = 0;

  function findApproval() {
    const now = Date.now();
    if (now - lastApprovalAt < 30000) return false; // at most one per 30s
    const buttons = document.querySelectorAll('button, [role="button"]');
    for (const el of buttons) {
      if (seenApprovalNodes.has(el) || !isVisible(el)) continue;
      const label = buttonLabel(el).toLowerCase();
      if (label.length > 20) continue;
      if (APPROVAL_WORDS.includes(label)) {
        seenApprovalNodes.add(el);
        lastApprovalAt = now;
        return true;
      }
    }
    const dialogs = document.querySelectorAll('[role="alertdialog"]');
    for (const el of dialogs) {
      if (seenApprovalNodes.has(el) || !isVisible(el)) continue;
      seenApprovalNodes.add(el);
      lastApprovalAt = now;
      return true;
    }
    return false;
  }

  // --- notify ------------------------------------------------------------
  function shouldNotify() {
    if (!settings.enabled) return false;
    if (!settings.onlyWhenHidden) return true;
    return document.hidden || !document.hasFocus();
  }

  function notify(kind, title, body) {
    if (!shouldNotify()) return;
    try {
      chrome.runtime.sendMessage({
        type: "toast-bridge-notify",
        kind,
        title,
        body,
      });
    } catch (e) {
      // Background worker unreachable: nothing we can do from here.
    }
  }

  // --- state machine ------------------------------------------------------
  let working = false;
  let workingSince = 0;
  let settleTimer = null;
  const SETTLE_MS = 2000; // idle must persist 2s before we call it "done"

  function scan() {
    if (!settings.enabled) return;

    const nowWorking = isWorking();
    if (nowWorking && !working) {
      working = true;
      workingSince = Date.now();
      if (settleTimer) {
        clearTimeout(settleTimer);
        settleTimer = null;
      }
    } else if (!nowWorking && working && !settleTimer) {
      settleTimer = setTimeout(() => {
        settleTimer = null;
        if (isWorking()) return; // started again during the settle window
        working = false;
        const ranSeconds = (Date.now() - workingSince) / 1000;
        if (settings.notifyDone && ranSeconds >= (settings.minWorkingSeconds || 0)) {
          notify(
            "done",
            "Muse finished",
            `Muse finished a task in "${document.title || "Muse"}".`
          );
        }
      }, SETTLE_MS);
    }

    if (settings.notifyApproval && findApproval()) {
      notify(
        "need",
        "Muse is waiting for you",
        "Muse needs your approval or an answer before it can continue."
      );
    }
  }

  // Observe DOM changes (throttled) plus a 1s interval fallback, so we catch
  // state changes even if the mutation batch arrives in an odd order.
  let scanQueued = false;
  function queueScan() {
    if (scanQueued) return;
    scanQueued = true;
    setTimeout(() => {
      scanQueued = false;
      scan();
    }, 300);
  }

  const observer = new MutationObserver(queueScan);
  if (document.body) {
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-label", "title", "disabled", "class"],
    });
  }
  setInterval(scan, 1000);
  scan();
})();
