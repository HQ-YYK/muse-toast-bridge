// "Muse is working" detection.
//
// muse.ai is Meta's agent ("Hatch"). It replaces the composer's send button
// with a stop / "generating" control while a task runs, and may show a spinner
// or progress step list. We treat any of these as "working":
//
//   1. A visible Stop / "Stop generating" button (primary cross-version signal).
//   2. A visible generating/spinner indicator (secondary signal).
//   3. Any user-supplied selector from options (escape hatch for redesigns).

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
    hasStopButton() ||
    hasGeneratingIndicator() ||
    hasCustomWorkingIndicator(selectors)
  );
}
