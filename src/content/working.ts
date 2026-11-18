// "Muse is working" detection.
//
// From the real muse.ai DOM (2026-11), the agent's activity bubble carries a
// status icon whose container has a Tailwind class of the form
// `bg-status-working-tint` (working) or `bg-status-success-tint` (done). The
// status text also lives in a `title` attribute ("让智能体安装依赖并构建打包"
// while working, "已完成 · …" when done).
//
// Reliable signals, in priority order:
//   1. A visible element whose class contains a Muse status token
//      (status-working / status-running / status-thinking / status-generating).
//   2. A Stop / "Stop generating" button (older layout).
//   3. A generating/thinking/working indicator (spinner / live region).
//   4. Any user-supplied selector from options (escape hatch).

import { buttonLabel, isVisible, normalize, visibleButtons } from "./dom";

const STOP_PATTERNS = [
  /^stop( generating)?$/,
  /^停止$/,
  /^停止生成$/,
  /^pause$/,
];

const GENERATING_PATTERNS = [
  /generating/i,
  /thinking/i,
  /working/i,
  /running/i,
  /in progress/i,
  /处理中/,
  /生成中/,
  /思考中/,
  /进行中/,
];

// Tailwind status tokens observed on Muse's agent activity icon container.
// "working" tokens mean a task is running; "success"/"done" tokens mean a task
// has finished. We only treat the *working* ones as "busy".
const STATUS_WORKING_PATTERNS = [
  /status-working/,
  /status-running/,
  /status-thinking/,
  /status-generating/,
  /status-in-progress/,
];

// "finished" tokens — used to detect completion directly (see hasFinishedStatus).
const STATUS_FINISHED_PATTERNS = [
  /status-success/,
  /status-done/,
  /status-complete/,
  /status-completed/,
];

/** A visible element whose class names include a Muse "busy" status token. */
export function hasStatusClassIndicator(): boolean {
  const nodes = document.querySelectorAll<Element>("[class]");
  for (const el of Array.from(nodes)) {
    const cls = el.getAttribute("class") ?? "";
    if (STATUS_WORKING_PATTERNS.some((re) => re.test(cls))) {
      if (isVisible(el)) return true;
    }
  }
  return false;
}

/**
 * A visible element whose class names include a Muse "finished" status token.
 * Exposed so the caller can drive "done" from an explicit success state instead
 * of relying solely on the working→idle edge (which misses when the working
 * bubble is hidden in a collapsed container, so `isVisible` never saw it).
 */
export function hasFinishedStatus(): boolean {
  const nodes = document.querySelectorAll<Element>("[class]");
  for (const el of Array.from(nodes)) {
    const cls = el.getAttribute("class") ?? "";
    if (STATUS_FINISHED_PATTERNS.some((re) => re.test(cls))) {
      if (isVisible(el)) return true;
    }
  }
  return false;
}

export function hasStopButton(): boolean {
  for (const el of visibleButtons()) {
    const label = normalize(buttonLabel(el));
    if (label.length > 40) continue;
    if (STOP_PATTERNS.some((re) => re.test(label))) return true;
  }
  return false;
}

export function hasGeneratingIndicator(): boolean {
  // Spinners / status text that mention generating.
  const nodes = document.querySelectorAll<Element>(
    '[role="status"], [aria-live="polite"], [aria-live="assertive"], [data-testid*="generat"], [data-testid*="spinner"], [class*="spinner"], [class*="loading"]',
  );
  for (const el of Array.from(nodes)) {
    if (!isVisible(el)) continue;
    const text = normalize(el.textContent ?? "");
    if (text && GENERATING_PATTERNS.some((re) => re.test(text))) return true;
  }
  return false;
}

export function hasCustomWorkingIndicator(selectors: string[]): boolean {
  for (const sel of selectors) {
    if (!sel) continue;
    try {
      const el = document.querySelector<Element>(sel);
      if (el && isVisible(el)) return true;
    } catch {
      // Bad selector from options: ignore, don't break the scan.
    }
  }
  return false;
}

export function isWorking(selectors: string[]): boolean {
  return (
    hasStatusClassIndicator() ||
    hasStopButton() ||
    hasGeneratingIndicator() ||
    hasCustomWorkingIndicator(selectors)
  );
}
