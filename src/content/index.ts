// Toast Bridge — content script for muse.ai.
//
// Orchestrates the two detectors (working / approval) and notifies the
// background worker when:
//   - a task finishes ("done"): a "working" indicator was visible for a while,
//     then disappeared and stayed gone for a short settle period.
//   - Muse waits for the user ("need"): an approval prompt appears.

import { DEFAULT_SETTINGS, type Settings } from "../shared/settings";
import { findApproval } from "./approval";
import { hasFinishedStatus, isWorking } from "./working";

(() => {
  if (window.__toastBridgeLoaded) return;
  window.__toastBridgeLoaded = true;

  let settings: Settings = { ...DEFAULT_SETTINGS };

  try {
    chrome.storage.sync.get(DEFAULT_SETTINGS, (items) => {
      settings = { ...DEFAULT_SETTINGS, ...items } as Settings;
    });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "sync") return;
      for (const [key, change] of Object.entries(changes)) {
        (settings as unknown as Record<string, unknown>)[key] = change.newValue;
      }
    });
  } catch {
    // Storage unavailable (e.g. in tests): keep defaults.
  }

  // Approval notifications are rate-limited: at most one per 30s.
  let lastApprovalAt = 0;

  // Debug logging: flips on with a `?tbdebug` query on the muse page, or by
  // setting localStorage.__tbDebug = "1". Logs every state change so we can
  // tell "not detected" apart from "detected but suppressed by shouldNotify".
  const DEBUG =
    location.search.includes("tbdebug") ||
    (typeof localStorage !== "undefined" && localStorage.getItem("__tbDebug") === "1");
  function dbg(...args: unknown[]): void {
    if (DEBUG) console.log("[toast-bridge]", ...args);
  }

  function shouldNotify(): boolean {
    if (!settings.enabled) return false;
    if (!settings.onlyWhenHidden) return true;
    return document.hidden || !document.hasFocus();
  }

  function notify(kind: "done" | "need", title: string, body: string): void {
    if (!shouldNotify()) return;
    try {
      chrome.runtime.sendMessage({
        type: "toast-bridge-notify",
        kind,
        title,
        body,
      });
    } catch {
      // Background worker unreachable: nothing we can do from here.
    }
  }

  // --- state machine -----------------------------------------------------
  let working = false;
  let workingSince = 0;
  let settleTimer: number | null = null;
  const SETTLE_MS = 2000; // idle must persist 2s before we call it "done"

  // A task can finish two ways:
  //   1. working → idle (stop button / spinner gone) — the "done" edge below.
  //   2. an explicit "finished" status bubble appears (status-success etc.).
  // We track a finishedSince so case 2 can also fire "done" after it settles.
  let finishedSince = 0;

  function fireDone(ranSeconds: number): void {
    dbg("fireDone", { ranSeconds });
    if (
      settings.notifyDone &&
      ranSeconds >= (settings.minWorkingSeconds || 0)
    ) {
      notify(
        "done",
        "Muse finished",
        `Muse finished a task in "${document.title || "Muse"}".`,
      );
    }
  }

  function scan(): void {
    if (!settings.enabled) return;

    const nowWorking = isWorking(settings.workingSelectors);
    const nowFinished = hasFinishedStatus();

    if (nowWorking && !working) {
      working = true;
      workingSince = Date.now();
      finishedSince = 0;
      dbg("working started");
      if (settleTimer !== null) {
        clearTimeout(settleTimer);
        settleTimer = null;
      }
    } else if (!nowWorking && working && settleTimer === null) {
      settleTimer = window.setTimeout(() => {
        settleTimer = null;
        if (isWorking(settings.workingSelectors)) return; // restarted
        working = false;
        const ranSeconds = (Date.now() - workingSince) / 1000;
        dbg("working stopped", { ranSeconds });
        fireDone(ranSeconds);
      }, SETTLE_MS);
    }

    // Explicit "finished" bubble (case 2): start timing when a finished status
    // appears while we aren't already "working", and fire once it has settled.
    if (nowFinished && !working) {
      if (finishedSince === 0) {
        finishedSince = Date.now();
        dbg("finished status seen");
      }
      const ranSeconds = (Date.now() - finishedSince) / 1000;
      // Fire after the finished bubble has been visible for a settle period.
      if (ranSeconds >= SETTLE_MS / 1000) {
        fireDone(ranSeconds);
        finishedSince = 0; // avoid re-firing on every scan
      }
    } else if (!nowFinished) {
      finishedSince = 0;
    }

    if (settings.notifyApproval) {
      const now = Date.now();
      if (now - lastApprovalAt < 30000) return;
      if (findApproval(settings.approvalSelectors)) {
        lastApprovalAt = now;
        dbg("approval detected");
        notify(
          "need",
          "Muse is waiting for you",
          "Muse needs your approval or an answer before it can continue.",
        );
      }
    }
  }

  // Observe DOM changes (throttled) plus a 1s interval fallback.
  let scanQueued = false;
  function queueScan(): void {
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
      attributeFilter: ["aria-label", "title", "disabled", "class", "data-testid"],
    });
  }
  setInterval(scan, 1000);
  scan();
  dbg("loaded; settings =", settings, "; onlyWhenHidden =", settings.onlyWhenHidden);
})();
