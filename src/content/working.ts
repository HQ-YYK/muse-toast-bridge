// "Muse is working" / "Muse finished" detection.
//
// From the real muse.ai DOM (2026-11), the agent's activity bubble carries a
// status icon whose container has a Tailwind class like
// `bg-status-working-tint` (working) or `bg-status-success-tint` (done).
//
// Working signals, in priority order:
//   1. A visible element whose class contains a "busy" status token.
//   2. A Stop / "Stop generating" button (older layout).
//   3. A short spinner/status label that says generating/thinking/...
//   4. Any user-supplied selector from options (escape hatch).
//
// Finished signal: visible elements with a "success" status token. Every past
// task in the chat history has one, so the caller must only react to elements
// it has not seen before (see index.ts), never to "any is visible".

import { buttonLabel, normalize, visibleAll, visibleButtons, visibleCustom } from "./dom";

const STATUS_WORKING_SELECTOR = [
  "status-working",
  "status-running",
  "status-thinking",
  "status-generating",
  "status-in-progress",
].map((t) => `[class*="${t}"]`).join(", ");

const STATUS_FINISHED_SELECTOR = [
  "status-success",
  "status-done",
  "status-complete",
].map((t) => `[class*="${t}"]`).join(", ");

const STOP_PATTERNS = [/^stop( generating)?$/, /^停止$/, /^停止生成$/, /^pause$/];

const GENERATING_PATTERNS = [
  /generating/,
  /thinking/,
  /working/,
  /running/,
  /in progress/,
  /处理中/,
  /生成中/,
  /思考中/,
  /进行中/,
];

const INDICATOR_SELECTOR =
  '[role="status"], [aria-live="polite"], [aria-live="assertive"], [data-testid*="generat"], [data-testid*="spinner"], [class*="spinner"], [class*="loading"]';

// A spinner label is short ("Thinking…"). Longer text is a message body that
// merely mentions "running" etc., which must not count as busy.
const MAX_INDICATOR_TEXT = 30;

function hasStopButton(): boolean {
  for (const el of visibleButtons()) {
    const label = normalize(buttonLabel(el));
    if (label.length > 40) continue;
    if (STOP_PATTERNS.some((re) => re.test(label))) return true;
  }
  return false;
}

function hasGeneratingIndicator(): boolean {
  for (const el of visibleAll(INDICATOR_SELECTOR)) {
    const text = normalize(el.textContent ?? "");
    if (!text || text.length > MAX_INDICATOR_TEXT) continue;
    if (GENERATING_PATTERNS.some((re) => re.test(text))) return true;
  }
  return false;
}

export function isWorking(customSelectors: string[]): boolean {
  return (
    visibleAll(STATUS_WORKING_SELECTOR).length > 0 ||
    hasStopButton() ||
    hasGeneratingIndicator() ||
    visibleCustom(customSelectors).length > 0
  );
}

/** Visible "finished" status elements (includes historical ones). */
export function finishedElements(): Element[] {
  return visibleAll(STATUS_FINISHED_SELECTOR);
}
