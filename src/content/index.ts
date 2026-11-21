// Toast Bridge — content script for muse.ai.
//
// Notifies the background worker when:
//   - a task finishes ("done"): a working episode ends (indicator gone for
//     SETTLE_MS), or a *new* finished-status bubble appears.
//   - Muse waits for the user ("need"): a *new* approval/decision prompt appears.
//
// "New" is the key idea. The chat history keeps every old finished bubble and
// every answered decision card on screen, so "is any visible" is always true.
// We remember every element we have already seen (WeakSet) and only react to
// elements that were not there before. On page load, on conversation switch,
// and after re-enabling, the current DOM is taken as a silent baseline.

import { DEFAULT_SETTINGS, type Settings } from "../shared/settings";
import { approvalCandidates } from "./approval";
import { finishedElements, isWorking } from "./working";

(() => {
  if (window.__toastBridgeLoaded) return;
  window.__toastBridgeLoaded = true;

  const SETTLE_MS = 2000; // idle must persist this long before "done"
  const SCAN_THROTTLE_MS = 300;
  const APPROVAL_COOLDOWN_MS = 30000;
  // A finished bubble arriving this soon after an episode closed belongs to
  // that episode (already handled), not to a new task.
  const BUBBLE_GRACE_MS = 15000;

  // `?tbdebug` once turns debug on for this origin (sticky in localStorage),
  // so it survives navigation that drops the query; `?tbdebug=0` turns it off.
  const debugParam = new URLSearchParams(location.search).get("tbdebug");
  try {
    if (debugParam === "0") localStorage.removeItem("__tbDebug");
    else if (debugParam !== null) localStorage.setItem("__tbDebug", "1");
  } catch {
    // localStorage blocked: fall back to the query param only.
  }
  let DEBUG = debugParam !== null && debugParam !== "0";
  try {
    DEBUG = DEBUG || localStorage.getItem("__tbDebug") === "1";
  } catch {
    // ignore
  }
  function dbg(...args: unknown[]): void {
    if (DEBUG) console.log("[toast-bridge]", ...args);
  }

  let settings: Settings = { ...DEFAULT_SETTINGS };

  function shouldNotify(): boolean {
    if (!settings.enabled) return false;
    if (!settings.onlyWhenHidden) return true;
    return document.hidden || !document.hasFocus();
  }

  function notify(kind: "done" | "need", title: string, body: string): void {
    if (!shouldNotify()) {
      dbg("suppressed (tab focused)", kind);
      return;
    }
    try {
      chrome.runtime.sendMessage({ type: "toast-bridge-notify", kind, title, body });
    } catch {
      // Extension reloaded / worker unreachable: nothing we can do from here.
    }
  }

  // --- state -------------------------------------------------------------
  let seen = new WeakSet<Element>();
  let needBaseline = true;
  let lastPath = location.pathname;

  let working = false;
  let workingSince = 0; // 0 = no open working episode
  let idleSince = 0;
  let lastApprovalAt = 0;
  let lastEpisodeEndAt = 0;

  /** Returns the elements in `els` not seen before, and marks all as seen. */
  function takeNew(els: Element[]): Element[] {
    const fresh = els.filter((el) => !seen.has(el));
    for (const el of fresh) seen.add(el);
    return fresh;
  }

  function baseline(): void {
    seen = new WeakSet();
    takeNew(finishedElements());
    takeNew(approvalCandidates(settings.approvalSelectors));
    working = isWorking(settings.workingSelectors);
    workingSince = working ? Date.now() : 0;
    idleSince = 0;
    needBaseline = false;
    dbg("baseline taken", { working });
  }

  function fireDone(ranSeconds: number | null): void {
    workingSince = 0; // close the episode so it can't fire twice
    lastEpisodeEndAt = Date.now();
    dbg("done", { ranSeconds });
    if (!settings.notifyDone) return;
    // Unknown duration (finished bubble with no observed working phase):
    // notify, since only agent tasks render a status bubble.
    if (ranSeconds !== null && ranSeconds < (settings.minWorkingSeconds || 0)) return;
    notify("done", "Muse finished", `Muse finished a task in "${document.title || "Muse"}".`);
  }

  function scan(): void {
    if (!settings.enabled) {
      needBaseline = true;
      return;
    }
    if (location.pathname !== lastPath) {
      lastPath = location.pathname;
      needBaseline = true;
    }
    if (needBaseline) {
      baseline();
      return;
    }

    const now = Date.now();

    // 1. Working episode: open on idle -> working, close after SETTLE_MS idle.
    if (isWorking(settings.workingSelectors)) {
      if (!working) {
        working = true;
        workingSince = workingSince || now;
        dbg("working started");
      }
      idleSince = 0;
    } else if (working) {
      if (idleSince === 0) {
        idleSince = now;
        // One-off timer (not chained), so background-tab throttling keeps it
        // near 1s precision; the timestamp check below is what decides.
        setTimeout(scan, SETTLE_MS + 50);
      } else if (now - idleSince >= SETTLE_MS) {
        working = false;
        if (workingSince) fireDone((idleSince - workingSince) / 1000);
        idleSince = 0;
      }
    }

    // 2. A new finished bubble while idle reports a task whose working phase
    //    we never saw (e.g. inside a collapsed container). While working,
    //    step bubbles ("已完成 · 某一步") are ignored: the episode end above
    //    reports the task once. Bubbles right after an episode are its own.
    if (takeNew(finishedElements()).length > 0) {
      if (working) {
        dbg("finished bubble during work (step), ignored");
      } else if (now - lastEpisodeEndAt >= BUBBLE_GRACE_MS) {
        fireDone(null);
      } else {
        dbg("finished bubble belongs to the episode just closed");
      }
    }

    // 3. New approval / decision prompt.
    const freshApproval = takeNew(approvalCandidates(settings.approvalSelectors));
    if (freshApproval.length > 0 && settings.notifyApproval) {
      dbg("new approval prompt", freshApproval);
      if (now - lastApprovalAt >= APPROVAL_COOLDOWN_MS) {
        lastApprovalAt = now;
        notify(
          "need",
          "Muse is waiting for you",
          "Muse needs your approval or an answer before it can continue.",
        );
      }
    }
  }

  // Leading-edge throttle driven by DOM mutations. Mutation callbacks are not
  // throttled in background tabs the way timers are, so this keeps detection
  // prompt while the Muse tab is hidden.
  let lastScanAt = 0;
  let trailingQueued = false;
  function queueScan(): void {
    const now = Date.now();
    if (now - lastScanAt >= SCAN_THROTTLE_MS) {
      lastScanAt = now;
      scan();
    } else if (!trailingQueued) {
      trailingQueued = true;
      setTimeout(() => {
        trailingQueued = false;
        lastScanAt = Date.now();
        scan();
      }, SCAN_THROTTLE_MS);
    }
  }

  function start(): void {
    const observer = new MutationObserver(queueScan);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-label", "title", "disabled", "class", "data-testid"],
    });
    setInterval(scan, 1000);
    scan();
    dbg("started", { url: location.href, topFrame: window === window.top, settings });
  }

  // Load settings first, then start, so the first baseline uses real settings.
  try {
    chrome.storage.sync.get(DEFAULT_SETTINGS, (items) => {
      settings = { ...DEFAULT_SETTINGS, ...items } as Settings;
      start();
    });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "sync") return;
      const s = settings as unknown as Record<string, unknown>;
      const defaults = DEFAULT_SETTINGS as unknown as Record<string, unknown>;
      for (const [key, change] of Object.entries(changes)) {
        s[key] = change.newValue === undefined ? defaults[key] : change.newValue;
      }
      // Selectors changed: re-baseline so matches already on screen stay quiet.
      if ("workingSelectors" in changes || "approvalSelectors" in changes) {
        needBaseline = true;
      }
    });
  } catch {
    // Storage unavailable (e.g. in tests): run with defaults.
    start();
  }
})();
